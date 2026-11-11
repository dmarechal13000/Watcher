import { useEffect } from 'react';
import { connect } from 'react-redux';
import { loadProfile } from '../../actions/profile';

function GlobalZoomHandler({ user, zoomLevel, loadProfile }) {
    
    useEffect(() => {
        if (user) {
            loadProfile();
        }
    }, [user, loadProfile]);

    useEffect(() => {
        const currentZoom = user ? (Number(zoomLevel) || 1.0) : 1.0;
        const root = document.documentElement;
        document.body.style.zoom = currentZoom;

        // Under CSS zoom every length inside <body> is scaled, `100vh` included, so full-height
        // elements (sidebar, shell...) would stop short of the bottom. Publish the real viewport
        // height expressed in zoomed CSS px, for the stylesheet to use instead of 100vh.
        const publishViewport = () => {
            root.style.setProperty('--wt-zoom', String(currentZoom));
            root.style.setProperty('--wt-vh', `${window.innerHeight / currentZoom}px`);
        };
        publishViewport();
        window.addEventListener('resize', publishViewport);

        return () => {
            window.removeEventListener('resize', publishViewport);
            document.body.style.zoom = 1.0;
            root.style.removeProperty('--wt-zoom');
            root.style.removeProperty('--wt-vh');
        };
    }, [zoomLevel, user]);

    return null;
}

const mapStateToProps = (state) => ({
    user: state.auth.user,
    zoomLevel: state.profile?.ui_zoom_level 
});

export default connect(mapStateToProps, { loadProfile })(GlobalZoomHandler);