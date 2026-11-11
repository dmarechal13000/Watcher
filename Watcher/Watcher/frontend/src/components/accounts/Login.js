import React, { Component } from "react";
import { Link, Redirect } from "react-router-dom";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import { login } from "../../actions/auth";
import { createMessage } from "../../actions/messages";
import { WatcherLogo } from "../common/WatcherMark";

export class Login extends Component {
    state = {
        username: "",
        password: "",
        showPassword: false,
    };

    static propTypes = {
        login: PropTypes.func.isRequired,
        createMessage: PropTypes.func.isRequired,
        isAuthenticated: PropTypes.bool,
        location: PropTypes.object,
        loginMode: PropTypes.string,
        oidcCompanyName: PropTypes.string,
    };

    componentDidMount() {
        const params = new URLSearchParams(window.location.search);
        if (params.get("sso_error")) {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
            this.props.createMessage({
                ssoError: "SSO authentication failed. Please try again or sign in with your credentials.",
            });
        }
    }

    onSubmit = e => {
        e.preventDefault();
        this.props.login(this.state.username, this.state.password);
    };

    onChange = e => this.setState({ [e.target.name]: e.target.value });

    togglePassword = () => this.setState(s => ({ showPassword: !s.showPassword }));

    render() {
        const redirectPath = this.props.location?.state?.from || "/overview";
        if (this.props.isAuthenticated) {
            return <Redirect to={redirectPath} />;
        }

        const { username, password, showPassword } = this.state;

        const loginMode = this.props.loginMode || "form_only";
        const hasSso    = loginMode === "both" || loginMode === "sso_only";
        const hasForm   = loginMode === "both" || loginMode === "form_only";
        const ssoLabel  = this.props.oidcCompanyName ? `${this.props.oidcCompanyName} SSO` : "SSO";
        const ssoLoginUrl = `/api/auth/oidc/login/?next=/#${redirectPath}`;

        return (
            <div className="wt-login">
                <div className="wt-login-top">
                    <Link to="/" className="wt-login-brand" title="Back to Threats Watcher">
                        <WatcherLogo size={46} />
                        <div>
                            <strong>Watcher</strong>
                            <small>Thales Group CERT · Cyber Threat Intelligence Platform</small>
                        </div>
                    </Link>
                    <span className="wt-pill">
                        <span className="wt-pill-dot" />
                        Open source · AI-powered
                    </span>
                </div>

                <section className="wt-login-hero">
                    <div className="wt-eyebrow">Threat intelligence &amp; hunting</div>
                    <h1>
                        Know what targets you.
                        <span className="wt-accent">Before it hits.</span>
                    </h1>
                    <p className="wt-lead">
                        Watcher continuously tracks trending threats, leaked data and look-alike domains
                        aimed at your organisation, then pushes what matters straight into your tools.
                    </p>
                    {[
                        { icon: "track_changes", title: "AI-powered threat watch",  text: "RSS, CVE and ransomware feeds, summarised and scored." },
                        { icon: "policy",        title: "Leak & domain detection",  text: "Paste sites, code registries and typosquatted domains." },
                        { icon: "share",         title: "Straight into your stack", text: "TheHive, MISP, Slack, Citadel or email." },
                    ].map(f => (
                        <div key={f.title} className="wt-feature">
                            <span className="wt-icon-chip"><i className="material-icons">{f.icon}</i></span>
                            <div>
                                <strong>{f.title}</strong>
                                <span>{f.text}</span>
                            </div>
                        </div>
                    ))}
                </section>

                <section className="wt-login-card">
                    <h2>Welcome back</h2>
                    <p className="text-muted small mb-4">Sign in to your Watcher account to continue.</p>

                    {/* SSO button */}
                    {hasSso && (
                        <>
                            <a
                                href={ssoLoginUrl}
                                className="btn btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
                                style={{ fontSize: "1rem" }}
                            >
                                <i className="material-icons" style={{ fontSize: 19 }}>verified_user</i>
                                Continue with {ssoLabel}
                                <i className="material-icons" style={{ fontSize: 18 }}>arrow_forward</i>
                            </a>
                            {this.props.oidcCompanyName && (
                                <p className="text-muted text-center mt-2 mb-0" style={{ fontSize: ".78rem" }}>
                                    Same login you use for other {this.props.oidcCompanyName} apps.
                                </p>
                            )}
                        </>
                    )}

                    {/* Divider */}
                    {hasSso && hasForm && <div className="wt-divider">OR</div>}

                    {/* Credentials form */}
                    {hasForm && (
                        <form onSubmit={this.onSubmit} noValidate>
                            <div className="form-floating mb-3">
                                <input
                                    id="login-username"
                                    type="text"
                                    className="form-control"
                                    name="username"
                                    value={username}
                                    onChange={this.onChange}
                                    placeholder="Username"
                                    autoComplete="username"
                                    autoFocus
                                />
                                <label htmlFor="login-username">Username</label>
                            </div>

                            <div className="form-floating mb-4 position-relative">
                                <input
                                    id="login-password"
                                    type={showPassword ? "text" : "password"}
                                    className="form-control"
                                    name="password"
                                    value={password}
                                    onChange={this.onChange}
                                    placeholder="Password"
                                    autoComplete="current-password"
                                    maxLength="100"
                                    style={{ paddingRight: "3.25rem" }}
                                />
                                <label htmlFor="login-password">Password</label>
                                <button
                                    type="button"
                                    className="wt-password-toggle"
                                    onClick={this.togglePassword}
                                    tabIndex={-1}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    <i className="material-icons" style={{ fontSize: 19 }}>
                                        {showPassword ? "visibility_off" : "visibility"}
                                    </i>
                                </button>
                            </div>

                            <button
                                type="submit"
                                className={`btn btn-lg w-100 d-flex align-items-center justify-content-center gap-2 ${hasSso ? "wt-btn-ink" : "btn-primary"}`}
                                style={{ fontSize: "1rem" }}
                                disabled={!username.trim() || !password}
                            >
                                Sign in
                                <i className="material-icons" style={{ fontSize: 18 }}>arrow_forward</i>
                            </button>
                        </form>
                    )}

                    <p className="wt-login-foot mb-0">
                        Trouble signing in? Contact your Watcher administrator.
                    </p>
                </section>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    isAuthenticated: state.auth.isAuthenticated,
    loginMode:       state.config.loginMode,
    oidcCompanyName: state.config.oidcCompanyName,
});

export default connect(
    mapStateToProps,
    { login, createMessage }
)(Login);
