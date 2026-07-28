from rest_framework import serializers
from .models import LegitimateDomain, PendingAction
from timeline.models import TimelineEvent
from pymisp import MISPEvent
from common.misp import create_misp_tags, create_or_update_objects, get_misp_uuid, update_misp_uuid
import logging

# Legitimate Domain Serializer
class LegitimateDomainSerializer(serializers.ModelSerializer):
    last_event = serializers.SerializerMethodField()

    class Meta:
        model = LegitimateDomain
        fields = [
            'id',
            'domain_name',
            'ticket_id',
            'contact',
            'created_at',
            'domain_created_at',
            'expiry',
            'ssl_expiry',
            'repurchased',
            'comments',
            'misp_event_uuid',
            'last_event',
        ]

    def get_last_event(self, obj):
        events = getattr(obj, '_timeline_events', None)
        if events is not None:
            event = events[0] if events else None
        else:
            event = obj.timeline_events.select_related('user__profile').first()
        if not event:
            return None
        u = event.user
        avatar_color = None
        if u:
            try:
                avatar_color = u.profile.avatar_color or None
            except Exception:
                pass
        return {
            'username': u.username if u else 'system',
            'first_name': u.first_name if u else '',
            'last_name': u.last_name if u else '',
            'avatar_color': avatar_color,
            'action': event.action,
            'timestamp': event.timestamp,
        }

    def validate_domain_name(self, value):
        """
        Check if the domain already exists in Legitimate Domains
        """
        if self.instance is None:
            if LegitimateDomain.objects.filter(domain_name=value).exists():
                raise serializers.ValidationError(
                    f'{value} Already exists in Legitimate Domains'
                )
        else:
            current = getattr(self.instance, 'domain_name', None)
            if value != current and LegitimateDomain.objects.filter(domain_name=value).exists():
                raise serializers.ValidationError(
                    f'{value} Already exists in Legitimate Domains'
                )
        return value

    def to_internal_value(self, data):
        # Convert "" to None for date fields
        if data.get("expiry") == "":
            data["expiry"] = None
        if data.get("domain_created_at") == "":
            data["domain_created_at"] = None
        if data.get("ssl_expiry") == "":
            data["ssl_expiry"] = None
        return super().to_internal_value(data)

    def to_representation(self, instance):
        """
        Intercepts data before sending it to the front-end 
        to ensure that misp_event_uuid is strictly a string.
        """
        data = super().to_representation(instance)
        misp_uuid = data.get('misp_event_uuid')
        
        if isinstance(misp_uuid, list):
            safe_uuids = []
            for item in misp_uuid:
                if isinstance(item, list):
                    safe_uuids.extend([str(i) for i in item if i])
                elif item:
                    safe_uuids.append(str(item))
            
            data['misp_event_uuid'] = ", ".join(safe_uuids)
            
        elif misp_uuid is None:
            data['misp_event_uuid'] = ""
            
        return data

# PendingAction Serializer
class PendingActionSerializer(serializers.ModelSerializer):
    resolved_by_username = serializers.SerializerMethodField()
    action_type_label = serializers.SerializerMethodField()

    class Meta:
        model = PendingAction
        fields = [
            'id',
            'action_type',
            'action_type_label',
            'status',
            'title',
            'description',
            'metadata',
            'created_at',
            'resolved_at',
            'resolved_by',
            'resolved_by_username',
        ]
        read_only_fields = ['id', 'created_at', 'resolved_at', 'resolved_by']

    def get_resolved_by_username(self, obj):
        return obj.resolved_by.username if obj.resolved_by else None

    def get_action_type_label(self, obj):
        return obj.get_action_type_display()

class LegitimateDomainMISPSerializer(serializers.Serializer):
    """
    Dedicated serializer for exporting a LegitimateDomain to MISP.
    It replicates the logic of dns_finder's MISPSerializer but targets the correct model.
    """
    id = serializers.IntegerField()
    event_uuid = serializers.CharField(required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from connectors.core import get_misp_config
        misp = get_misp_config()
        
        from pymisp import PyMISP
        import os
        
        misp_url = misp.get('url', os.environ.get('MISP_URL', ''))
            
        self.misp_api = PyMISP(
            url=misp_url,
            key=misp.get('key', os.environ.get('MISP_KEY', '')),
            ssl=misp.get('verify_ssl', False),
        )
        self._message = ""

    def validate(self, data):
        """
        Validate that the LegitimateDomain exists in the database.
        """
        try:
            legit_id = data['id']
            try:
                self.legitimate_domain = LegitimateDomain.objects.get(pk=legit_id)
            except LegitimateDomain.DoesNotExist:
                raise serializers.ValidationError({"id": "Legitimate domain not found"})

            return data
            
        except serializers.ValidationError:
            raise
        except Exception:
            logger.exception("Unexpected validation error in Common MISP serializer")
            raise serializers.ValidationError("An internal error occurred during validation.")

    def save(self):
        """
        Create or update the MISP event for this legitimate domain.
        """
        try:
            legitimate_domain = self.legitimate_domain
            event_uuid = self.validated_data.get('event_uuid')
            
            if event_uuid:
                event = self.misp_api.get_event(event_uuid)
                success, message = create_or_update_objects(
                    self.misp_api, 
                    event, 
                    legitimate_domain 
                )
                
                if success:
                    update_misp_uuid(legitimate_domain.domain_name, event_uuid)
                    
            else:
                event = MISPEvent()
                event.distribution = 0
                event.threat_level_id = 2
                event.analysis = 0
                event.info = f"Legitimate domain {legitimate_domain.domain_name}"
                event.tags = create_misp_tags(self.misp_api)

                event = self.misp_api.add_event(event, pythonify=True)
                success, message = create_or_update_objects(
                    self.misp_api,
                    {'Event': {'id': event.id, 'uuid': event.uuid}},
                    legitimate_domain
                )

                if success:
                    update_misp_uuid(legitimate_domain.domain_name, event.uuid)

            if not success:
                raise serializers.ValidationError(message)

            self._message = message
            return {
                "message": message,
                "misp_event_uuid": get_misp_uuid(legitimate_domain.domain_name),
                "status": "success"
            }

        except serializers.ValidationError:
            raise
        except Exception:
            logger.exception("Unexpected error in Common MISP save")
            raise serializers.ValidationError("An internal error occurred while processing the MISP event.")

    @property
    def data(self):
        return {
            'id': self.legitimate_domain.id,
            'misp_event_uuid': get_misp_uuid(self.legitimate_domain.domain_name),
            'message': self._message
        }