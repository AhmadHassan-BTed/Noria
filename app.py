import streamlit as st
import os
import logging

# Suppress benign Streamlit ScriptRunContext warnings
logging.getLogger("streamlit").setLevel(logging.ERROR)

def suppress_streamlit_shutdown_websocket_error():
    """Avoid noisy Streamlit websocket tracebacks during normal server shutdown."""
    try:
        from streamlit.runtime.runtime import RuntimeStoppedError
        from streamlit.web.server.browser_websocket_handler import BrowserWebSocketHandler
    except Exception:
        return

    if getattr(BrowserWebSocketHandler.on_message, "_noria_shutdown_patch", False):
        return

    original_on_message = BrowserWebSocketHandler.on_message

    def patched_on_message(self, payload):
        try:
            return original_on_message(self, payload)
        except RuntimeStoppedError:
            return None

    patched_on_message._noria_shutdown_patch = True
    BrowserWebSocketHandler.on_message = patched_on_message


suppress_streamlit_shutdown_websocket_error()

from ui.styles import apply_custom_styles
from ui.state import (
    load_profiles,
    cleanup_zombie_processes,
    perform_server_startup_cleanup
)
from ui.components.navigation import render_sidebar_navigation
from ui.views.profile_form import render_profile_form_view
from ui.views.scans import render_scans_view
from ui.views.profiles import render_profiles_view

# Streamlit config and styling
apply_custom_styles()
os.makedirs("data", exist_ok=True)

# Trigger cached server startup cleanup once globally
@st.cache_resource
def global_startup_cleanup():
    return perform_server_startup_cleanup()

global_startup_cleanup()

# Initialize session state variables
if "focused_scan" not in st.session_state:
    st.session_state.focused_scan = {}
if "show_add_scan" not in st.session_state:
    st.session_state.show_add_scan = {}
if "linking_profile" not in st.session_state:
    st.session_state.linking_profile = None
if "linker_sess_id" not in st.session_state:
    st.session_state.linker_sess_id = None
if "current_page" not in st.session_state:
    st.session_state.current_page = "Profiles"

# Handle active process monitoring & data load
running_instances = cleanup_zombie_processes()
profiles = load_profiles()

# Render Sidebar Navigation
render_sidebar_navigation()

# Main page routing
current_page = st.session_state.current_page
editing_profile = st.session_state.get("editing_profile", None)

if current_page == "Scans":
    render_scans_view(running_instances, profiles)
elif editing_profile is not None:
    render_profile_form_view(editing_profile, profiles)
else:
    render_profiles_view(profiles, running_instances)
