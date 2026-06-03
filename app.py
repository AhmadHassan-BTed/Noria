import streamlit as st
import subprocess
import os
import json
import time
import signal
import warnings
from PIL import Image
import io

# Suppress Streamlit ScriptRunContext warning when running in bare mode
# This warning is benign and occurs when @st.fragment is used outside of a full Streamlit context
import logging
logging.getLogger("streamlit").setLevel(logging.ERROR)

# Optional qrcode import fallback
try:
    import qrcode
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False

# =============================================================================
# Streamlit Page Config & Custom Styling (Apple Aesthetics)
# =============================================================================
# Streamlit Page Config & Custom Styling (WhatsApp Dark Theme)
st.set_page_config(
    page_title="Noria — Control Center",
    page_icon="📡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Premium Custom CSS to enforce the WhatsApp Dark Theme (#212121 / #25D366 / #FFFFFF)
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap');

    /* Global style overrides */
    html, body, [class*="css"], .stApp {
        font-family: 'Inter', sans-serif !important;
        background-color: #212121 !important;
        color: #FFFFFF !important;
    }

    /* Streamlit top header & decoration bar */
    header[data-testid="stHeader"] {
        background-color: #212121 !important;
        border-bottom: 1px solid #2D2D2D !important;
    }

    header[data-testid="stHeader"] * {
        color: #FFFFFF !important;
    }

    div[data-testid="stDecoration"] {
        background-image: linear-gradient(90deg, #25D366, #20ba5a) !important;
    }

    h1, h2, h3, h4, h5, h6 {
        font-family: 'Outfit', sans-serif !important;
        color: #FFFFFF !important;
        font-weight: 700 !important;
    }

    /* Subheader and special section spacing */
    .stSubheader h3 {
        border-bottom: 2px solid #2D2D2D;
        padding-bottom: 8px;
        margin-top: 24px;
        margin-bottom: 16px;
    }

    /* Sidebar container styling */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #181818 0%, #0F0F0F 100%) !important;
        border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
    }

    [data-testid="stSidebar"] * {
        color: #FFFFFF !important;
    }

    /* Sidebar scrollbar styling */
    [data-testid="stSidebar"]::-webkit-scrollbar {
        width: 4px !important;
    }
    [data-testid="stSidebar"]::-webkit-scrollbar-thumb {
        background-color: rgba(37, 211, 102, 0.2) !important;
        border-radius: 10px !important;
    }

    /* Sidebar info box styling */
    [data-testid="stSidebar"] div[data-testid="stAlert"] {
        background: rgba(255, 255, 255, 0.01) !important;
        border: 1px solid rgba(255, 255, 255, 0.04) !important;
        border-left: 3px solid #25D366 !important;
        border-radius: 8px !important;
        padding: 12px 16px !important;
        margin-top: 20px !important;
    }

    [data-testid="stSidebar"] div[data-testid="stAlert"] div {
        color: #B0B3B8 !important;
        font-size: 13px !important;
        line-height: 1.5 !important;
    }

    /* Sidebar button navigation (Inactive secondary) */
    [data-testid="stSidebar"] div.stButton > button {
        width: 100% !important;
        text-align: left !important;
        border-radius: 6px !important;
        border: 1px solid transparent !important;
        border-left: 4px solid transparent !important;
        background-color: transparent !important;
        color: #8E9297 !important;
        margin-bottom: 8px !important;
        padding: 12px 16px !important;
        font-weight: 500 !important;
        font-size: 14px !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    [data-testid="stSidebar"] div.stButton > button:hover {
        border-color: rgba(255, 255, 255, 0.05) !important;
        border-left: 4px solid rgba(37, 211, 102, 0.5) !important;
        color: #FFFFFF !important;
        background-color: rgba(255, 255, 255, 0.02) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        transform: translateX(4px) !important;
    }

    /* Sidebar active primary navigation buttons */
    [data-testid="stSidebar"] div.stButton > button[kind="primary"] {
        background-color: rgba(37, 211, 102, 0.06) !important;
        color: #25D366 !important;
        border: 1px solid rgba(37, 211, 102, 0.15) !important;
        border-left: 4px solid #25D366 !important;
        border-radius: 6px !important;
        font-weight: 600 !important;
        font-size: 14px !important;
        box-shadow: inset 0 0 10px rgba(37, 211, 102, 0.05), 0 4px 12px rgba(0, 0, 0, 0.2) !important;
        transform: translateX(4px) !important;
    }

    [data-testid="stSidebar"] div.stButton > button[kind="primary"]:hover {
        background-color: rgba(37, 211, 102, 0.1) !important;
        color: #25D366 !important;
        border-color: rgba(37, 211, 102, 0.25) !important;
        border-left: 4px solid #25D366 !important;
        box-shadow: inset 0 0 10px rgba(37, 211, 102, 0.08), 0 4px 15px rgba(37, 211, 102, 0.15) !important;
        transform: translateX(4px) !important;
    }

    /* Reset the topmost root vertical block wrapper to avoid colored/broken page container */
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] {
        border: none !important;
        background-color: transparent !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
    }

    /* General containers & cards (Level 1) */
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"],
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] {
        border: 1px solid #2D2D2D !important;
        border-radius: 14px !important;
        background-color: #2B2B2B !important;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25) !important;
        padding: 24px !important;
        margin-bottom: 20px !important;
        transition: border-color 0.2s ease-in-out !important;
    }

    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"]:hover {
        border-color: #333333 !important;
    }

    /* General Level 1 Expander details styling */
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] > details {
        border: none !important;
        background: transparent !important;
    }

    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] summary {
        background-color: #2B2B2B !important;
        color: #FFFFFF !important;
        font-family: 'Outfit', sans-serif !important;
        font-weight: 700 !important;
        font-size: 1.15rem !important;
        padding: 16px 20px !important;
        border-radius: 14px !important;
        transition: color 0.2s ease-in-out !important;
    }

    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] summary:hover,
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] summary:hover * {
        color: #25D366 !important;
        fill: #25D366 !important;
    }

    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] details[open] summary {
        border-bottom: 1px solid #2D2D2D !important;
        border-bottom-left-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
    }

    /* Style for device header toggle buttons to look like expanders */
    div[class*="st-key-dev_hdr_btn"] button {
        background-color: #1F1F1F !important;
        color: #FFFFFF !important;
        border: 1px solid #2D2D2D !important;
        border-radius: 10px !important;
        text-align: left !important;
        justify-content: flex-start !important;
        font-family: 'Outfit', sans-serif !important;
        font-weight: 600 !important;
        padding: 10px 14px !important;
        margin-bottom: -10px !important;
    }
    div[class*="st-key-dev_hdr_btn"] button:hover {
        color: #25D366 !important;
        border-color: #25D366 !important;
        background-color: #282828 !important;
    }

    /* Nested containers (subsections / sub-cards, Level 2) styling to differ in shade */
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"],
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] {
        background-color: #141414 !important;
        border-color: #2D2D2D !important;
        box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3) !important;
        padding: 20px !important;
        margin-top: 10px !important;
        margin-bottom: 10px !important;
    }

    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover {
        border-color: #25D366 !important;
        box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(37, 211, 102, 0.1) !important;
    }

    /* Grandchild nested containers (Level 3 sub-cards) styling */
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"],
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] {
        background-color: #0A0A0A !important;
        border-color: #2D2D2D !important;
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.5) !important;
        padding: 16px !important;
    }

    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover {
        border-color: #25D366 !important;
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(37, 211, 102, 0.15) !important;
    }
    /* Buttons global overrides */
    button {
        border-radius: 8px !important;
        font-weight: 500 !important;
        transition: all 0.2s ease-in-out !important;
    }

    button[kind="primary"] {
        background-color: #25D366 !important;
        color: #121212 !important;
        border: 1px solid #25D366 !important;
    }

    button[kind="primary"]:hover {
        background-color: #20ba5a !important;
        color: #121212 !important;
        box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3) !important;
        transform: translateY(-1px);
    }

    button[kind="secondary"] {
        background-color: #2D2D2D !important;
        color: #FFFFFF !important;
        border: 1px solid #3E3E3E !important;
    }

    button[kind="secondary"]:hover {
        border-color: #25D366 !important;
        color: #25D366 !important;
        background-color: #333333 !important;
        box-shadow: 0 2px 8px rgba(37, 211, 102, 0.1) !important;
    }

    /* Input & form fields styling */
    div[data-baseweb="input"], div[data-baseweb="textarea"], div[data-baseweb="select"] {
        background-color: #1A1A1A !important;
        border: 1px solid #2D2D2D !important;
        border-radius: 8px !important;
        color: #FFFFFF !important;
    }

    /* Inputs inside Level 2 container should be darker */
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="input"],
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="input"],
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="textarea"],
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="textarea"],
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="select"],
    div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="select"] {
        background-color: #101010 !important;
    }

    input, textarea, select {
        color: #FFFFFF !important;
        background-color: transparent !important;
    }

    div[data-baseweb="input"]:focus-within, div[data-baseweb="textarea"]:focus-within, div[data-baseweb="select"]:focus-within {
        border-color: #25D366 !important;
        box-shadow: 0 0 0 1px #25D366 !important;
    }

    /* Multi-select tag bubble styles */
    span[role="button"] {
        background-color: #2D2D2D !important;
        border: 1px solid #3E3E3E !important;
        color: #FFFFFF !important;
    }

    /* Expander styling - dynamic shades */
    div[data-testid="stExpander"] {
        background-color: #2B2B2B !important;
        border: 1px solid #2D2D2D !important;
        border-radius: 10px !important;
    }

    div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] {
        background-color: #1A1A1A !important;
    }

    div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"],
    div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stExpander"] {
        background-color: #101010 !important;
    }

    /* Alerts styling (info, success, warning, error) */
    div[data-testid="stAlert"] {
        background-color: #2b2b2b !important;
        border: 1px solid #2D2D2D !important;
        border-radius: 10px !important;
    }

    div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stAlert"] {
        background-color: #1A1A1A !important;
    }

    div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stAlert"],
    div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stAlert"] {
        background-color: #101010 !important;
    }

    /* Logs & Code display */
    code {
        color: #25D366 !important;
        background-color: #121212 !important;
        font-family: 'Courier New', Courier, monospace !important;
        font-size: 13.5px !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
    }

    pre {
        background-color: #121212 !important;
        border: 1px solid #2D2D2D !important;
        border-radius: 10px !important;
        padding: 16px !important;
        box-shadow: inset 0 2px 8px rgba(0,0,0,0.4) !important;
    }

    pre code {
        padding: 0 !important;
        background-color: transparent !important;
    }

    /* Toast styling overrides */
    div[data-testid="stToast"] {
        background-color: #1A1A1A !important;
        color: #FFFFFF !important;
        border-left: 5px solid #25D366 !important;
    }

    /* Progress bar coloring */
    div[role="progressbar"] > div {
        background-color: #25D366 !important;
    }

    /* Custom scrollbars */
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    ::-webkit-scrollbar-track {
        background: #212121;
    }
    ::-webkit-scrollbar-thumb {
        background: #3E3E3E;
        border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
        background: #25D366;
    }
</style>
""", unsafe_allow_html=True)

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

def kill_zombie_node_chrome_processes():
    try:
        import psutil
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                name = proc.info.get('name')
                if name and 'node' in name.lower():
                    cmdline = proc.info.get('cmdline') or []
                    if any('launcher.js' in arg for arg in cmdline):
                        proc.kill()
                elif name and 'chrome' in name.lower():
                    cmdline = proc.info.get('cmdline') or []
                    if any('headless' in arg for arg in cmdline) and any('.wwebjs_auth' in arg for arg in cmdline):
                        proc.kill()
            except Exception:
                pass
    except Exception:
        pass

@st.cache_resource
def perform_server_startup_cleanup():
    # Kill any stale node/chrome processes from previous runs on server start
    kill_zombie_node_chrome_processes()
    try:
        if os.path.exists("data/processes.json"):
            with open("data/processes.json", "w") as f:
                json.dump({}, f)
    except Exception:
        pass
    return True

# Trigger server startup cleanup once globally
perform_server_startup_cleanup()

PROCESS_FILE = "data/processes.json"
PROFILE_FILE = "data/profiles.json"

PREDEFINED_SCANS = {
    "daad_scholarships": {
        "name": "DAAD Germany Scholarships",
        "category": "Scholarships Discovery",
        "template": "scholarships",
        "channels": "DAAD Scholarship Alerts, Germany Study News, Pakistan Germany Student Network",
        "description": "Monitors German academic channels for master's and PhD scholarships."
    },
    "erasmus_scholarships": {
        "name": "Erasmus Mundus Coordinator",
        "category": "Scholarships Discovery",
        "template": "scholarships",
        "channels": "Erasmus Mundus Official, EU Scholarships Info, Erasmus Mundus Association",
        "description": "Evaluates fully funded Erasmus Mundus Joint Master's scholarship alerts."
    },
    "fulbright_scholarships": {
        "name": "US Fulbright Updates",
        "category": "Scholarships Discovery",
        "template": "scholarships",
        "channels": "USEFP Fulbright Updates, US Scholarships, Fulbright Alumni Network",
        "description": "Tracks US Fulbright scholarship calls and application guides."
    },
    "remote_react_dev": {
        "name": "Remote React/Node Developer Jobs",
        "category": "Job Search & Match",
        "template": "jobs",
        "channels": "JS Jobs Portal, Remote Web Dev Jobs, React Developer Opportunities",
        "description": "Scrapes and evaluates remote JS/TS, React, and Node.js roles."
    },
    "ai_ml_internships": {
        "name": "AI/ML Research & Engineering Internships",
        "category": "Job Search & Match",
        "template": "jobs",
        "channels": "AI Research Alerts, Deep Learning Internships, Machine Learning Careers",
        "description": "Monitors machine learning and artificial intelligence internship opportunities."
    }
}


# =============================================================================
# Helper Utilities
# =============================================================================
CREATED_SCANS_FILE = "data/created_scans.json"

def load_created_scans():
    if os.path.exists(CREATED_SCANS_FILE):
        try:
            with open(CREATED_SCANS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_created_scans(scans):
    try:
        with open(CREATED_SCANS_FILE, "w") as f:
            json.dump(scans, f, indent=2)
    except Exception as e:
        st.error(f"Failed to persist created scans: {e}")

def load_profiles():
    profiles = {}
    if os.path.exists(PROFILE_FILE):
        try:
            with open(PROFILE_FILE, "r") as f:
                profiles = json.load(f)
        except Exception:
            profiles = {}
    
    # Auto-seed from existing .env if present
    if not profiles:
        env_data = {}
        if os.path.exists(".env"):
            try:
                with open(".env", "r") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            env_data[k.strip()] = v.strip()
            except Exception:
                pass
            
        profiles = {
            "default": {
                "id": "default",
                "name": "Default Profile",
                "gemini_key": env_data.get("GEMINI_API_KEY", ""),
                "jina_key": env_data.get("JINA_API_KEY", ""),
                "applicant_name": env_data.get("APPLICANT_NAME", "Ahmad Hassan"),
                "applicant_nationality": env_data.get("APPLICANT_NATIONALITY", "Pakistani"),
                "applicant_degree_tier": env_data.get("APPLICANT_DEGREE_TIER", "BS Software Engineering (8th Sem)"),
                "applicant_target_fields": env_data.get("APPLICANT_TARGET_FIELDS", "Software Engineering, AI"),
                "applicant_focus": env_data.get("APPLICANT_RESEARCH_FOCUS", "Federated Learning, AI"),
                "devices": {}
            }
        }
        
        try:
            with open(PROFILE_FILE, "w") as f:
                json.dump(profiles, f, indent=2)
        except Exception:
            pass
            
    # Ensure "devices" dictionary exists for all profiles
    changed = False
    for p_id in profiles:
        if "devices" not in profiles[p_id]:
            profiles[p_id]["devices"] = {}
            changed = True
    if changed:
        try:
            with open(PROFILE_FILE, "w") as f:
                json.dump(profiles, f, indent=2)
        except Exception:
            pass
        
    return profiles

def save_profiles(profiles):
    try:
        with open(PROFILE_FILE, "w") as f:
            json.dump(profiles, f, indent=2)
    except Exception as e:
        st.error(f"Failed to persist profiles: {e}")

def load_running_processes():
    if os.path.exists(PROCESS_FILE):
        try:
            with open(PROCESS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_running_processes(processes):
    try:
        with open(PROCESS_FILE, "w") as f:
            json.dump(processes, f, indent=2)
    except Exception as e:
        st.error(f"Failed to persist processes state: {e}")

def get_session_status(session_id):
    status_path = f"data/status-{session_id}.json"
    if os.path.exists(status_path):
        try:
            with open(status_path, "r", encoding="utf-8", errors="replace") as f:
                return json.load(f)
        except Exception:
            return {"status": "UNKNOWN"}
    # No status file yet = process is still starting up, show loading bar
    return {"status": "UNKNOWN"}

def read_session_logs(session_id, max_lines=200):
    """Read the last N lines from a session's log file."""
    log_path = f"data/logs-{session_id}.log"
    if not os.path.exists(log_path):
        return []
    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
            # Return last max_lines, stripping newlines
            return [line.rstrip() for line in lines[-max_lines:]]
    except Exception:
        return []

def clear_session_logs(session_id):
    """Clear a session's log file."""
    log_path = f"data/logs-{session_id}.log"
    try:
        if os.path.exists(log_path):
            os.remove(log_path)
            return True
    except Exception:
        pass
    return False

def is_process_alive(pid):
    try:
        import psutil
        if not psutil.pid_exists(pid):
            return False
        p = psutil.Process(pid)
        return 'node' in p.name().lower()
    except ImportError:
        try:
            if os.name == 'nt':
                output = subprocess.check_output(f'tasklist /FI "PID eq {pid}" /NH', shell=True).decode()
                return str(pid) in output and 'node' in output.lower()
            else:
                os.kill(pid, 0)
                return True
        except Exception:
            return False

def cleanup_zombie_processes():
    """Clean up dead processes but preserve CONNECTED status files for the fragment to handle."""
    instances = load_running_processes()
    cleaned = {}
    changed = False
    
    for name, info in instances.items():
        if is_process_alive(info["pid"]):
            cleaned[name] = info
        else:
            # Check if the status file indicates a successful connection
            status_path = f"data/status-{info['sessionId']}.json"
            status_data = {}
            if os.path.exists(status_path):
                try:
                    with open(status_path, "r") as f:
                        status_data = json.load(f)
                except Exception:
                    pass
            
            # Keep CONNECTED status files and their process entries ONLY if they are linker sessions
            # so the fragment can process them and add the device
            is_linker = "linker" in info["sessionId"]
            if is_linker and status_data.get("status") == "CONNECTED":
                cleaned[name] = info
            else:
                # Delete QR files for dead processes but preserve status to reflect disconnected state
                changed = True
                try:
                    os.remove(f"data/qr-{info['sessionId']}.txt")
                except FileNotFoundError:
                    pass
                
                # If a normal scan daemon died, mark it as DISCONNECTED in the status file
                if not is_linker:
                    try:
                        with open(status_path, "w") as f:
                            json.dump({
                                "status": "DISCONNECTED",
                                "reason": "Scan process stopped unexpectedly"
                            }, f)
                    except Exception:
                        pass
    
    if changed:
        save_running_processes(cleaned)
    
    return cleaned

running_instances = cleanup_zombie_processes()
@st.fragment(run_every=2)
def render_device_linker_fragment(p_id, p_info, profiles):
    linker_sess_id = st.session_state.linker_sess_id
    if not linker_sess_id:
        return
        
    status_info = get_session_status(linker_sess_id)
    status = status_info.get("status", "UNKNOWN")
    
    # Track when linking started for timeout detection
    if "linker_start_time" not in st.session_state:
        st.session_state.linker_start_time = time.time()
    
    elapsed = time.time() - st.session_state.get("linker_start_time", time.time())
    
    st.markdown(f"**Connection Linker Status:** `{status}`")
    
    # ── Handle CONNECTED status ────────────────────────────────────────────
    if status == "CONNECTED":
        linked_phone = status_info.get("phone", "")
        linked_channels = status_info.get("channels", [])
        linked_wid = status_info.get("wid", "")
        
        # Fallback: if phone is empty but we have WID or session info, use that
        if not linked_phone and linked_wid:
            linked_phone = linked_wid.split('@')[0] if '@' in linked_wid else linked_wid
        
        # Final fallback: generate a device identifier from timestamp
        if not linked_phone:
            linked_phone = f"device_{int(time.time())}"
        
        # Ensure devices dict exists
        if "devices" not in p_info:
            p_info["devices"] = {}
        
        p_info["devices"][linked_phone] = {
            "phone": linked_phone,
            "channels": linked_channels,
            "linkedAt": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        save_profiles(profiles)
        
        # Stop any existing scans on this device to release file locks on dst_dir
        for name, info in list(running_instances.items()):
            is_matching_device = (
                info.get("phone") == linked_phone or
                info.get("devicePhone") == linked_phone or
                info.get("sessionId") == f"session_{p_id}_dev_{linked_phone}"
            )
            if info.get("profileId") == p_id and is_matching_device and name != linker_sess_id:
                try:
                    if os.name == 'nt':
                        subprocess.run(['taskkill', '/F', '/T', '/PID', str(info['pid'])], capture_output=True)
                    else:
                        os.kill(info['pid'], signal.SIGTERM)
                    del running_instances[name]
                except Exception:
                    pass
        
        if linker_sess_id in running_instances:
            del running_instances[linker_sess_id]
        save_running_processes(running_instances)
            
        try:
            os.remove(f"data/status-{linker_sess_id}.json")
        except FileNotFoundError:
            pass
        try:
            os.remove(f"data/qr-{linker_sess_id}.txt")
        except FileNotFoundError:
            pass
            
        # Clean up any previous error status file for this specific device
        try:
            os.remove(f"data/status-session_{p_id}_dev_{linked_phone}.json")
        except FileNotFoundError:
            pass
        
        st.session_state.linking_profile = None
        st.session_state.linker_sess_id = None
        st.session_state.pop("linker_start_time", None)
        st.success(f"Device +{linked_phone} linked successfully with {len(linked_channels)} subscribed channel(s)!")
        time.sleep(1)
        st.rerun()
            
    # ── Handle SCAN_QR status ──────────────────────────────────────────────
    elif status == "SCAN_QR":
        st.warning("Action Required: Scan the QR code below using WhatsApp Linked Devices.")
        
        qr_file = f"data/qr-{linker_sess_id}.txt"
        if os.path.exists(qr_file):
            try:
                with open(qr_file, "r") as f:
                    qr_data = f.read().strip()
                
                if HAS_QRCODE:
                    qr = qrcode.QRCode(version=1, box_size=5, border=2)
                    qr.add_data(qr_data)
                    qr.make(fit=True)
                    qr_img = qr.make_image(fill_color="black", back_color="white")
                    
                    buf = io.BytesIO()
                    # Convert to PIL Image for consistent save() signature
                    if hasattr(qr_img, 'get_image'):
                        # qrcode image with get_image() method (PIL-based)
                        pil_img = qr_img.get_image()
                        pil_img.save(buf, format='PNG')
                    elif hasattr(qr_img, 'save'):
                        # Direct save - try with format, fallback without
                        try:
                            qr_img.save(buf, format='PNG')  # type: ignore[call-arg]
                        except TypeError:
                            qr_img.save(buf)
                    else:
                        # Fallback: write raw bytes
                        buf.write(bytes(qr_img))
                    
                    st.image(buf.getvalue(), caption="Scan QR Code to Pair Device", width=220)
                else:
                    st.code(qr_data, language="text")
            except Exception as e:
                st.error(f"Failed to render QR: {e}")
        else:
            st.info("Loading QR Code from server...")
            
    # ── Handle DISCONNECTED status ─────────────────────────────────────────
    # Show loading bar for a grace period before displaying the error
    # This gives the process time to potentially recover or for QR to appear
    elif status == "DISCONNECTED":
        grace_period = 30  # seconds before showing actual error
        
        if elapsed < grace_period:
            # Still in grace period - show loading bar and wait
            curr_progress = st.session_state.get("linker_progress", 5)
            if curr_progress < 85:
                curr_progress += 3
                st.session_state.linker_progress = curr_progress

            if curr_progress <= 30:
                step_msg = "🚀 Launching Chrome headless engine..."
            elif curr_progress <= 50:
                step_msg = "🔌 Initializing WhatsApp connection..."
            elif curr_progress <= 70:
                step_msg = "🔑 Synchronizing authentication keys..."
            else:
                step_msg = "📱 Preparing QR code..."

            st.info(step_msg)
            st.progress(curr_progress / 100.0)
            st.caption(f"Elapsed: {int(elapsed)}s — Connecting to WhatsApp...")
            return
        
        # Grace period passed - show the actual error
        disconnect_reason = status_info.get("reason", "Connection was terminated")
        
        # Clean up the failed process entry
        if linker_sess_id in running_instances:
            del running_instances[linker_sess_id]
            save_running_processes(running_instances)
        
        st.error(f"❌ Connection failed: {disconnect_reason}")
        
        # Show logs if available
        log_lines = read_session_logs(linker_sess_id, max_lines=20)
        if log_lines:
            with st.expander("📋 View Error Logs", expanded=False):
                st.code("\n".join(log_lines[-10:]), language="text")
        
        # Retry button - also clean up status file
        if st.button("Try Again", key=f"retry_link_{p_id}", type="primary", use_container_width=True):
            # Clean up old status and QR files
            try:
                os.remove(f"data/status-{linker_sess_id}.json")
            except FileNotFoundError:
                pass
            try:
                os.remove(f"data/qr-{linker_sess_id}.txt")
            except FileNotFoundError:
                pass
            
            st.session_state.linking_profile = None
            st.session_state.linker_sess_id = None
            st.session_state.pop("linker_start_time", None)
            st.rerun()
            
    # ── Handle initializing/unknown status (progress animation) ────────────
    else:
        # Show loading progress bar during initialization
        timeout_seconds = 90  # 90 second timeout before declaring failure
        
        # Only show timeout error if we've waited long enough
        if elapsed > timeout_seconds:
            st.error(f"⏱️ Connection timed out after {int(elapsed)} seconds.")
            
            # Clean up
            if linker_sess_id in running_instances:
                del running_instances[linker_sess_id]
                save_running_processes(running_instances)
            
            if st.button("Try Again", key=f"retry_timeout_{p_id}", type="primary", use_container_width=True):
                st.session_state.linking_profile = None
                st.session_state.linker_sess_id = None
                st.session_state.pop("linker_start_time", None)
                st.rerun()
            return
        
        # Increment progress dynamically to animate initialization progress
        curr_progress = st.session_state.get("linker_progress", 5)
        if curr_progress < 90:  # Cap at 90% to show we're still waiting
            curr_progress += 5
            if curr_progress > 90:
                curr_progress = 90
            st.session_state.linker_progress = curr_progress

        if curr_progress <= 20:
            step_msg = "🚀 Launching Chrome headless engine..."
        elif curr_progress <= 40:
            step_msg = "🔌 Initializing WhatsApp connection..."
        elif curr_progress <= 60:
            step_msg = "🔑 Synchronizing authentication keys..."
        elif curr_progress <= 80:
            step_msg = "📱 Generating QR code for pairing..."
        else:
            step_msg = f"⏳ Waiting for WhatsApp response... ({int(elapsed)}s)"

        st.info(step_msg)
        st.progress(curr_progress / 100.0)
        st.caption(f"Elapsed: {int(elapsed)}s — Please wait while we connect to WhatsApp...")
        
        # Show hint if taking longer than usual
        if elapsed > 30:
            st.caption("💡 Taking longer than expected? Make sure Chrome is installed and accessible.")
        
    # Cancel button
    if st.button("Cancel Pairing", key=f"cancel_pair_{p_id}", use_container_width=True):
        linker_proc_info = running_instances.get(linker_sess_id)
        if linker_proc_info:
            try:
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/F', '/T', '/PID', str(linker_proc_info['pid'])], capture_output=True)
                else:
                    os.kill(linker_proc_info['pid'], signal.SIGTERM)
            except Exception:
                pass
            del running_instances[linker_sess_id]
            save_running_processes(running_instances)
            
        try:
            os.remove(f"data/status-{linker_sess_id}.json")
        except FileNotFoundError:
            pass
        try:
            os.remove(f"data/qr-{linker_sess_id}.txt")
        except FileNotFoundError:
            pass
        
        st.session_state.linking_profile = None
        st.session_state.linker_sess_id = None
        st.rerun()

# Initialize session states for inline active scans and add forms tracking
if "focused_scan" not in st.session_state:
    st.session_state.focused_scan = {}
if "show_add_scan" not in st.session_state:
    st.session_state.show_add_scan = {}
if "linking_profile" not in st.session_state:
    st.session_state.linking_profile = None
if "linker_sess_id" not in st.session_state:
    st.session_state.linker_sess_id = None

# Initialize active page state
if "current_page" not in st.session_state:
    st.session_state.current_page = "Profiles"

# =============================================================================
# Sidebar Navigation Panel (Clean SaaS Layout)
# =============================================================================
st.sidebar.markdown("""
<div style="display: flex; align-items: center; justify-content: center; gap: 12px; padding: 18px 12px; background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin-top: 10px; margin-bottom: 25px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);">
    <svg width="42" height="42" viewBox="0 0 299 300" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M149.789 0C67.9177 0 1.27639 66.4656 1.24166 148.157C1.23297 174.271 8.0751 199.761 21.0734 222.228L0 299.017L78.7453 278.412C100.444 290.218 124.869 296.436 149.728 296.445H149.789C231.651 296.445 298.292 229.971 298.327 148.279C298.345 108.689 282.906 71.4631 254.861 43.4616C226.815 15.4515 189.522 0.0173223 149.789 0ZM149.789 271.423H149.737C127.587 271.423 105.853 265.473 86.8985 254.256L82.3921 251.589L35.6694 263.818L48.138 218.373L45.2032 213.714C32.8474 194.105 26.3179 171.439 26.3266 148.175C26.3526 80.2715 81.7409 25.0307 149.841 25.0307C182.819 25.0394 213.816 37.8665 237.121 61.1477C260.435 84.4202 273.26 115.366 273.251 148.27C273.225 216.173 217.837 271.423 149.789 271.423Z" fill="#25D366"/>
      <path d="M156.792 213.075L141.536 213.075L141.536 85.9421L156.792 85.9421L156.792 213.075Z" fill="#25D366"/>
      <path d="M97.9276 187.898L90.2996 174.686L200.4 111.119L208.028 124.331L97.9276 187.898Z" fill="#25D366"/>
      <path d="M90.2996 124.331L97.9276 111.119L208.028 174.686L200.4 187.898L90.2996 124.331Z" fill="#25D366"/>
      <path d="M121.032 60.403C121.032 57.0892 123.718 54.403 127.032 54.403H171.296C174.609 54.403 177.296 57.0892 177.296 60.403V65.9421C177.296 76.9878 168.341 85.9421 157.296 85.9421H141.032C129.986 85.9421 121.032 76.9878 121.032 65.9421V60.403Z" fill="#212121" stroke="#25D366" stroke-width="16"/>
      <path d="M121.032 219.075C121.032 215.761 123.718 213.075 127.032 213.075H171.296C174.609 213.075 177.296 215.761 177.296 219.075V224.614C177.296 235.66 168.341 244.614 157.296 244.614H141.032C129.986 244.614 121.032 235.66 121.032 224.614V219.075Z" fill="#212121" stroke="#25D366" stroke-width="16"/>
      <path d="M51.5605 103.653C51.5605 100.339 54.2468 97.6532 57.5605 97.6532H101.824C105.138 100.339 107.824 100.339 107.824 103.653V109.192C107.824 120.238 98.87 129.192 87.8243 129.192H71.5605C60.5148 129.192 51.5605 120.238 51.5605 109.192V103.653Z" fill="#212121" stroke="#25D366" stroke-width="16"/>
      <path d="M190.503 103.653C190.503 100.339 193.189 97.6532 196.503 97.6532H240.767C244.081 97.6532 246.767 100.339 246.767 103.653V109.192C246.767 120.238 237.813 129.192 226.767 129.192H210.503C199.457 129.192 190.503 120.238 190.503 109.192V103.653Z" fill="#212121" stroke="#25D366" stroke-width="16"/>
      <path d="M51.5605 175.825C51.5605 172.511 54.2468 169.825 57.5605 169.825H101.824C105.138 169.825 107.824 172.511 107.824 175.825V181.364C107.824 192.41 98.87 201.364 87.8243 201.364H71.5605C60.5148 201.364 51.5605 192.41 51.5605 181.364V175.825Z" fill="#212121" stroke="#25D366" stroke-width="16"/>
      <path d="M190.503 175.825C190.503 172.511 193.189 169.825 196.503 169.825H240.767C244.081 169.825 246.767 172.511 246.767 175.825V181.364C246.767 192.41 237.813 201.364 226.767 201.364H210.503C199.457 201.364 190.503 192.41 190.503 181.364V175.825Z" fill="#212121" stroke="#25D366" stroke-width="16"/>
    </svg>
    <span style="color: #FFFFFF; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 28px; letter-spacing: 0.5px;">Noria</span>
</div>
<div style="font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #8E9297; text-align: center; margin-bottom: 20px;">SaaS Orchestration Console</div>
<div style="height: 1px; background: rgba(255, 255, 255, 0.05); margin: 20px 0;"></div>
""", unsafe_allow_html=True)

# Styled Sidebar Buttons for Navigation
if st.sidebar.button("👤 Applicant Profiles", use_container_width=True, type="primary" if st.session_state.current_page == "Profiles" else "secondary"):
    st.session_state.current_page = "Profiles"
    st.rerun()

if st.sidebar.button("📡 Opportunity Scans", use_container_width=True, type="primary" if st.session_state.current_page == "Scans" else "secondary"):
    st.session_state.current_page = "Scans"
    st.rerun()

st.sidebar.markdown("""
<div style="height: 1px; background: rgba(255, 255, 255, 0.05); margin: 20px 0;"></div>

<div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-left: 3px solid #25D366; border-radius: 8px; padding: 14px; margin-bottom: 15px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
    <div style="font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #25D366; margin-bottom: 6px;">About</div>
    <div style="font-family: 'Inter', sans-serif; font-size: 12.5px; line-height: 1.5; color: #8E9297;">
        An agentic extractor for messaging platforms. Noria receives messages & URLs via chat; scrapes web data to evaluate the content against custom scoring matrices (e.g., jobs, scholarships); and sends a structured summary with a calculated match score directly to the assigned messenger number.
    </div>
</div>

<div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-left: 3px solid #25D366; border-radius: 8px; padding: 14px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
    <div style="font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #25D366; margin-bottom: 6px;">Unified Control</div>
    <div style="font-family: 'Inter', sans-serif; font-size: 12.5px; line-height: 1.5; color: #8E9297;">
        Manage independent customer profiles, API keys, and launch dynamic opportunity scans entirely from the unified profile directory.
    </div>
</div>

<div style="height: 1px; background: rgba(255, 255, 255, 0.05); margin: 20px 0 15px 0;"></div>

<div style="text-align: center; font-family: 'Inter', sans-serif; font-size: 11px; color: #8E9297; padding-bottom: 10px;">
    Designed & Engineered by <br>
    <a href="https://github.com/AhmadHassan-BTed" target="_blank" style="color: #25D366; text-decoration: none; font-weight: 600; font-family: 'Outfit', sans-serif; transition: color 0.2s;">Ahmad Hassan (B-Ted)</a>
</div>
""", unsafe_allow_html=True)

# =============================================================================
# Main View: SaaS Applicant Profiles Directory
# =============================================================================
profiles = load_profiles()

if st.session_state.current_page == "Scans":
    st.title("📡 Active Scanning Operations")
    st.write("Monitor live opportunity extraction pipelines, review discovery diagnostics, and terminate active scans.")
    st.write("---")
    
    # 1. Master List of Active Scans
    st.subheader("📡 Active Opportunity Scans")
    
    if not running_instances:
        st.info("No active opportunity scans are running in the system. Use the launchpad below to start one.")
    else:
        # Display as a neat list of container cards
        for scan_name, info in sorted(running_instances.items()):
            with st.container(border=True):
                col_info, col_status, col_action = st.columns([3, 1, 1])
                with col_info:
                    st.markdown(f"#### `{scan_name}`")
                    st.markdown(f"""
                    * **Powered By Profile:** {info['profileName']} (`{info['profileId']}`)
                    * **Pipeline Category:** {info['category']}
                    * **Monitored Channels:** `{info.get('channels') or 'All subscribed links'}`
                    * **Target Phone:** `{info['phone'] or 'Default target'}`
                    * **Started At:** {info['startedAt']}
                    """)
                with col_status:
                    status_info = get_session_status(info["sessionId"])
                    scan_status = status_info.get("status", "UNKNOWN")
                    if scan_status == "CONNECTED":
                        disc_status = status_info.get("discoveryStatus", "COMPLETED")
                        if disc_status == "DISCOVERING":
                            disc_progress = status_info.get("discoveryProgress", 0)
                            disc_msg = status_info.get("discoveryMessage", "Discovering channels...")
                            st.warning(f"🔍 Discovery: {disc_progress}%")
                            st.progress(disc_progress / 100.0)
                            st.caption(f"_{disc_msg}_")
                        else:
                            st.success("Linked & Active")
                    elif scan_status == "SCAN_QR":
                        st.warning("Awaiting Scan")
                    else:
                        st.info(scan_status)
                        
                with col_action:
                    if st.button("Stop Scan", key=f"stop_global_{scan_name}", use_container_width=True):
                        try:
                            if os.name == 'nt':
                                subprocess.run(['taskkill', '/F', '/T', '/PID', str(info['pid'])], capture_output=True)
                            else:
                                os.kill(info['pid'], signal.SIGTERM)
                            
                            # Evict process details
                            del running_instances[scan_name]
                            save_running_processes(running_instances)
                            st.toast(f"Scan '{scan_name}' stopped successfully.")
                            time.sleep(1)
                            st.rerun()
                        except Exception as e:
                            st.error(f"Failed to terminate process: {e}")

    st.write("---")
    
    # 2. Master Form to Launch a New Scan
    st.subheader("🚀 Launch New Opportunity Scan")
    
    if not profiles:
        st.warning("You must create an Applicant Profile first before you can launch an opportunity scan.")
    else:
        with st.container(border=True):
            selected_p_id = st.selectbox(
                "Select Applicant Profile to Power Scan",
                options=list(profiles.keys()),
                format_func=lambda x: profiles[x]["name"],
                key="global_scan_profile_selector"
            )
            selected_profile = profiles[selected_p_id]
            
            # Show a brief summary card of selected profile credentials/target
            st.markdown(f"**Selected Profile Target Fields:** `{selected_profile.get('applicant_target_fields', 'Not set')}`")
            
            st.write("---")
            
            global_scan_mode = st.radio(
                "Choose Scan Configuration Method",
                ["Select Predefined Scan", "Create Custom Scan"],
                horizontal=True,
                key="global_scan_mode"
            )
            
            if global_scan_mode == "Select Predefined Scan":
                selected_predef_key = st.selectbox(
                    "Available Opportunity Scans",
                    options=list(PREDEFINED_SCANS.keys()),
                    format_func=lambda x: PREDEFINED_SCANS[x]["name"],
                    key="global_predef_select",
                    help="Choose a preconfigured scan targeting popular academic or job channels."
                )
                selected_scan_info = PREDEFINED_SCANS[selected_predef_key]
                
                with st.container(border=True):
                    st.markdown(f"**Description:** {selected_scan_info['description']}")
                    st.markdown(f"**Pipeline Category:** `{selected_scan_info['category']}`")
                    st.markdown(f"**Channels to Monitor:** `{selected_scan_info['channels']}`")
                
                global_phone = st.text_input(
                    "Notification Target Phone",
                    placeholder="e.g. +923001234567",
                    key="global_phone_predef",
                    help="Phone number to receive matching opportunity notifications via WhatsApp."
                ).strip()
                
                global_category = selected_scan_info["category"]
                global_template = selected_scan_info["template"]
                global_scan_name = selected_predef_key
                global_channels = selected_scan_info["channels"]
                
            else:
                global_category = st.selectbox(
                    "Select Opportunity Pipeline",
                    ["Scholarships Discovery", "Job Search & Match"],
                    key="global_cat_selector",
                    help="Select the classification type of opportunities you want to search and evaluate."
                )
                global_template = "scholarships" if global_category == "Scholarships Discovery" else "jobs"
                
                global_scan_name = st.text_input(
                    "Name this Scan",
                    placeholder="e.g. scholarship_europe, jobs_germany",
                    key="global_scan_name_input",
                    help="A unique name to identify this scan instance."
                ).strip().replace(" ", "_")

                global_phone = st.text_input(
                    "Notification Target Phone",
                    placeholder="e.g. +923001234567",
                    key="global_phone_input",
                    help="Phone number to receive matching opportunity notifications via WhatsApp."
                ).strip()

                global_channels = st.text_area(
                    "WhatsApp Channels to Monitor (Comma separated)",
                    placeholder="e.g. Scholarship Alerts, 923009876543@newsletter",
                    key="global_channels_input",
                    help="Specify names or IDs of subscribed WhatsApp Channels. Leave blank to process all incoming links."
                )

            global_sess_id = f"session_{selected_p_id}"

            if st.button("Launch Scan", type="primary", use_container_width=True):
                if not global_scan_name:
                    st.error("Please enter a name for this scan.")
                else:
                    # Auto-suffix to avoid collision if running predefined/duplicate named scan
                    actual_scan_name = global_scan_name
                    if actual_scan_name in running_instances:
                        suffix = 2
                        candidate_name = f"{actual_scan_name}_{suffix}"
                        while candidate_name in running_instances:
                            suffix += 1
                            candidate_name = f"{actual_scan_name}_{suffix}"
                        actual_scan_name = candidate_name
                    
                    # Launch process
                    cmd = [
                        "node", "src/launcher.js",
                        "--template", global_template,
                        "--instance", actual_scan_name,
                        "--sessionId", global_sess_id
                    ]
                    if global_channels:
                        cmd.extend(["--channels", global_channels])
                    if global_phone:
                        cmd.extend(["--phone", global_phone])

                    custom_env = os.environ.copy()
                    custom_env.update({
                        "GEMINI_API_KEY": selected_profile["gemini_key"],
                        "JINA_API_KEY": selected_profile.get("jina_key", ""),
                        "APPLICANT_NAME": selected_profile["applicant_name"],
                        "APPLICANT_NATIONALITY": selected_profile["applicant_nationality"],
                        "APPLICANT_DEGREE_TIER": selected_profile["applicant_degree_tier"],
                        "APPLICANT_TARGET_FIELDS": selected_profile["applicant_target_fields"],
                        "APPLICANT_RESEARCH_FOCUS": selected_profile.get("applicant_focus", selected_profile.get("applicant_research_focus", ""))
                    })

                    try:
                        daemon_log = open(f"data/daemon-{actual_scan_name}.log", "a", encoding="utf-8")
                        p = subprocess.Popen(
                            cmd,
                            stdout=daemon_log,
                            stderr=subprocess.STDOUT,
                            env=custom_env,
                            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
                        )
                        
                        running_instances[actual_scan_name] = {
                            "pid": p.pid,
                            "template": global_template,
                            "category": global_category,
                            "sessionId": global_sess_id,
                            "profileId": selected_p_id,
                            "profileName": selected_profile["name"],
                            "channels": global_channels,
                            "phone": global_phone,
                            "startedAt": time.strftime("%Y-%m-%d %H:%M:%S")
                        }
                        save_running_processes(running_instances)
                        
                        st.success(f"Scan '{actual_scan_name}' launched successfully with PID {p.pid}.")
                        time.sleep(1)
                        st.rerun()
                    except Exception as e:
                        st.error(f"Failed to launch scan process: {e}")
    st.stop()

# =============================================================================
# Main View: SaaS Applicant Profiles Directory (Default Page)
# =============================================================================
st.title("👤 Applicant Profiles Directory")
st.write("Manage applicant profiles, configure Gemini API keys, pair WhatsApp channels, and orchestrate opportunity evaluation scans.")
st.write("---")

editing_profile = st.session_state.get("editing_profile", None)

if editing_profile is None:
    # Directory View
    cols = st.columns([5, 1])
    with cols[0]:
        st.write(f"Registered Customer Profiles: **{len(profiles)}**")
    with cols[1]:
        if st.button("➕ Add Profile", use_container_width=True):
            st.session_state.editing_profile = "new"
            st.rerun()
    
    st.write("")

    if not profiles:
        st.info("No applicant profiles registered yet. Click 'Add Profile' to create one.")
    else:
        # Display all profiles as dynamic native cards
        for p_id, p_info in sorted(profiles.items()):
            with st.expander(f"👤 {p_info['name']}", expanded=True):
                # Profile Quick Actions (inside expander at the top)
                card_header_cols = st.columns([5, 1.5, 1.5, 1.5])
                with card_header_cols[1]:
                    if st.button("🧹 Clear Cache", key=f"clear_cache_profile_{p_id}", use_container_width=True):
                        profile_scans = [
                            name for name, info in running_instances.items()
                            if info.get("profileId") == p_id
                        ]
                        for scan_name in profile_scans:
                            flag_path = f"data/clear-cache-{scan_name}.flag"
                            try:
                                with open(flag_path, "w") as f:
                                    f.write("clear")
                            except Exception:
                                pass
                        st.toast(f"Cache clear requested for {len(profile_scans)} active scan(s).")
                with card_header_cols[2]:
                    if st.button("✏️ Edit", key=f"edit_btn_{p_id}", use_container_width=True):
                        st.session_state.editing_profile = p_id
                        st.rerun()
                with card_header_cols[3]:
                    if st.button("🗑️ Delete", key=f"delete_btn_{p_id}", use_container_width=True):
                        if p_id == "default":
                            st.error("The Default Profile cannot be deleted.")
                        else:
                            del profiles[p_id]
                            save_profiles(profiles)
                            st.toast(f"Profile '{p_info['name']}' deleted.")
                            time.sleep(1)
                            st.rerun()
                
                st.write("---")
                
                # Profile Details & Status columns
                details_col, status_col = st.columns([1, 1])
                
                with details_col:
                    st.markdown("**Profile Parameters**")
                    st.markdown(f"""
                    * **Full Name:** {p_info.get('applicant_name', 'Not set')}
                    * **Nationality:** {p_info.get('applicant_nationality', 'Not set')}
                    * **Degree Tier & Grades:** {p_info.get('applicant_degree_tier', 'Not set')}
                    * **Target Fields:** `{p_info.get('applicant_target_fields', 'Not set')}`
                    * **Research Focus:** `{p_info.get('applicant_focus', p_info.get('applicant_research_focus', 'Not set'))}`
                    """)
                    
                    # API Config Indicator
                    has_gemini = "Yes" if p_info.get("gemini_key") else "No"
                    has_jina = "Yes" if p_info.get("jina_key") else "No"
                    st.markdown(f"**Gemini Configured:** `{has_gemini}` | **Jina Configured:** `{has_jina}`")
                    
                with status_col:
                    st.markdown("**📡 WhatsApp Device Authentications**")
                    
                    linking_active = (st.session_state.linking_profile == p_id)
                    
                    if linking_active:
                        render_device_linker_fragment(p_id, p_info, profiles)
                    else:
                        devices = p_info.get("devices", {})
                        if not devices:
                            st.info("No active devices linked to this profile.")
                        else:
                            st.success(f"Registered Devices: **{len(devices)}** linked.")
                            for d_phone in sorted(devices.keys()):
                                device_sess_id = f"session_{p_id}_dev_{d_phone}"
                                status_info = get_session_status(device_sess_id)
                                curr_status = status_info.get("status", "UNKNOWN")
                                reason = status_info.get("reason", "")
                                if curr_status in ["SCAN_QR", "auth_failure"]:
                                    st.markdown(f"⚠️ **Device Disconnected (Re-link required):** `+{d_phone}`")
                                elif curr_status == "DISCONNECTED" and not ("Stopped" in reason or "user" in reason.lower()):
                                    st.markdown(f"⚠️ **Device Offline:** `+{d_phone}`")
                                else:
                                    st.markdown(f"✅ **Device Active:** `+{d_phone}`")
                        
                        st.write("")
                        if st.button("🔗 Link WhatsApp Device", key=f"link_device_btn_{p_id}", use_container_width=True, type="primary"):
                            # Spawn background helper process to retrieve linking details
                            linker_sess_id = f"session_{p_id}_linker_{int(time.time())}"
                            cmd = [
                                "node", "src/launcher.js",
                                "--template", "scholarships",
                                "--instance", linker_sess_id,
                                "--sessionId", linker_sess_id
                            ]
                            
                            custom_env = os.environ.copy()
                            custom_env.update({
                                "GEMINI_API_KEY": p_info["gemini_key"],
                                "JINA_API_KEY": p_info.get("jina_key", ""),
                                "APPLICANT_NAME": p_info["applicant_name"],
                                "APPLICANT_NATIONALITY": p_info["applicant_nationality"],
                                "APPLICANT_DEGREE_TIER": p_info["applicant_degree_tier"],
                                "APPLICANT_TARGET_FIELDS": p_info["applicant_target_fields"],
                                "APPLICANT_RESEARCH_FOCUS": p_info["applicant_focus"]
                            })
                            
                            try:
                                daemon_log = open(f"data/daemon-{linker_sess_id}.log", "a", encoding="utf-8")
                                p = subprocess.Popen(
                                    cmd,
                                    stdout=daemon_log,
                                    stderr=subprocess.STDOUT,
                                    env=custom_env,
                                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
                                )
                                
                                running_instances[linker_sess_id] = {
                                    "pid": p.pid,
                                    "template": "scholarships",
                                    "category": "Linker",
                                    "sessionId": linker_sess_id,
                                    "profileId": p_id,
                                    "profileName": p_info["name"],
                                    "channels": "",
                                    "phone": "",
                                    "startedAt": time.strftime("%Y-%m-%d %H:%M:%S")
                                }
                                save_running_processes(running_instances)
                                
                                st.session_state.linking_profile = p_id
                                st.session_state.linker_sess_id = linker_sess_id
                                st.session_state.linker_progress = 5
                                st.rerun()
                            except Exception as e:
                                st.error(f"Failed to spawn linker socket: {e}")
                
                st.write("---")

                @st.fragment(run_every=2)
                def render_linked_devices_fragment(p_id, p_info, profiles, running_instances):
                    # Render Sub-cards for Registered Devices
                    st.markdown("### 📱 Linked Devices (Sub-cards)")
                    devices = p_info.get("devices", {})
                    if not devices:
                        st.info("No active devices linked to this profile. Pair a device upfront using the button above.")
                    else:
                        dev_cols = st.columns(min(len(devices), 3))
                        for idx, (dev_phone, dev_info) in enumerate(sorted(devices.items())):
                            col_idx = idx % min(len(devices), 3)
                            with dev_cols[col_idx]:
                                dev_expanded_key = f"dev_expanded_{p_id}_{dev_phone}"
                                if dev_expanded_key not in st.session_state:
                                    st.session_state[dev_expanded_key] = True
                                
                                is_dev_expanded = st.session_state[dev_expanded_key]
                                arrow = "▼" if is_dev_expanded else "▶"
                                if st.button(f"{arrow} 📱 +{dev_phone}", key=f"dev_hdr_btn_{p_id}_{dev_phone}", use_container_width=True):
                                    st.session_state[dev_expanded_key] = not is_dev_expanded
                                    st.rerun()
                                
                                if is_dev_expanded:
                                    with st.container(border=True):
                                        st.caption(f"Linked: {dev_info.get('linkedAt', 'Unknown')}")

                                        device_sess_id = f"session_{p_id}_dev_{dev_phone}"
                                        status_info = get_session_status(device_sess_id)
                                        curr_status = status_info.get("status", "UNKNOWN")
                                        reason = status_info.get("reason", "")

                                        if curr_status in ["SCAN_QR", "auth_failure"]:
                                            st.error("⚠️ Authentication Expired - Re-link required")
                                        elif curr_status == "DISCONNECTED":
                                            if "Stopped" in reason or "user" in reason.lower():
                                                st.info("💤 Inactive (Standby)")
                                            else:
                                                st.warning("⚠️ Offline")

                                        # Scans running on this device
                                        device_scans = [
                                            name for name, info in running_instances.items()
                                            if info.get("profileId") == p_id and (
                                                info.get("devicePhone") == dev_phone or 
                                                info.get("sessionId") == f"session_{p_id}_dev_{dev_phone}" or
                                                (not info.get("devicePhone") and info.get("phone") == dev_phone)
                                            )
                                        ]

                                        # Dynamic Channel, Group, and Chat Sync from active scans
                                        channels_list = dev_info.get("channels", [])
                                        groups_list = dev_info.get("groups", [])
                                        chats_list = dev_info.get("chats", [])
                                        profile_changed = False

                                        for scan_name in device_scans:
                                            scan_info = running_instances[scan_name]
                                            status_info = get_session_status(scan_info["sessionId"])

                                            discovered_channels = status_info.get("channels", [])
                                            if len(discovered_channels) > len(channels_list):
                                                channels_list = discovered_channels
                                                dev_info["channels"] = discovered_channels
                                                profile_changed = True

                                            discovered_groups = status_info.get("groups", [])
                                            if len(discovered_groups) > len(groups_list):
                                                groups_list = discovered_groups
                                                dev_info["groups"] = discovered_groups
                                                profile_changed = True

                                            discovered_chats = status_info.get("chats", [])
                                            if len(discovered_chats) > len(chats_list):
                                                chats_list = discovered_chats
                                                dev_info["chats"] = discovered_chats
                                                profile_changed = True

                                        if profile_changed:
                                            save_profiles(profiles)

                                        st.markdown(f"**Subscribed Channels:** `{len(channels_list)}` | **Groups:** `{len(groups_list)}` | **Direct Chats:** `{len(chats_list)}`")

                                        if not device_scans:
                                            st.info("No active scans on this device.")
                                        else:
                                            st.markdown("**Running Scans:**")
                                            for scan_name in device_scans:
                                                scan_info = running_instances[scan_name]
                                                st.markdown(f"🔸 `{scan_name}` (`{scan_info['category']}`)")

                                                status_info = get_session_status(scan_info["sessionId"])
                                                scan_status = status_info.get("status", "UNKNOWN")
                                                disc_status = status_info.get("discoveryStatus", "COMPLETED")

                                                if scan_status == "CONNECTED" and disc_status == "DISCOVERING":
                                                    disc_progress = status_info.get("discoveryProgress", 0)
                                                    disc_msg = status_info.get("discoveryMessage", "Discovering channels...")
                                                    st.warning(f"🔍 Discovery: {disc_progress}%")
                                                    st.progress(disc_progress / 100.0)
                                                    st.caption(f"_{disc_msg}_")

                                                act_col1, act_col2 = st.columns([1, 1])
                                                with act_col1:
                                                    if scan_status == "CONNECTED":
                                                        if disc_status == "DISCOVERING":
                                                            st.info("Syncing")
                                                        else:
                                                            st.success("Active")
                                                    elif scan_status == "DISCONNECTED":
                                                        reason = status_info.get("reason", "Disconnected")
                                                        st.error(f"Error: {reason}")
                                                    else:
                                                        st.warning("Connecting")
                                                with act_col2:
                                                    if st.button("Stop", key=f"stop_sub_{p_id}_{dev_phone}_{scan_name}", use_container_width=True):
                                                        try:
                                                            if os.name == 'nt':
                                                                subprocess.run(['taskkill', '/F', '/T', '/PID', str(scan_info['pid'])], capture_output=True)
                                                            else:
                                                                os.kill(scan_info['pid'], signal.SIGTERM)

                                                            del running_instances[scan_name]
                                                            save_running_processes(running_instances)

                                                            # Write DISCONNECTED status cleanly
                                                            status_path = f"data/status-{scan_info['sessionId']}.json"
                                                            try:
                                                                with open(status_path, "w") as f:
                                                                    json.dump({
                                                                        "status": "DISCONNECTED",
                                                                        "reason": "Stopped by user"
                                                                    }, f)
                                                            except Exception:
                                                                pass

                                                            st.toast(f"Scan '{scan_name}' stopped successfully.")
                                                            time.sleep(1)
                                                            st.rerun()
                                                        except Exception as e:
                                                            st.error(f"Error: {e}")

                                        st.write("---")

                                        # ── Device Log Viewer ──────────────────────────────────
                                        device_sess_id = f"session_{p_id}_dev_{dev_phone}"
                                        show_logs = st.toggle(f"📋 Show Device Logs — +{dev_phone}", value=False, key=f"toggle_logs_{p_id}_{dev_phone}")
                                        if show_logs:
                                            with st.container(border=True):
                                                log_col1, log_col2 = st.columns([3, 1])
                                                with log_col1:
                                                    st.caption(f"Session ID: `{device_sess_id}`")
                                                with log_col2:
                                                    if st.button("🗑️ Clear Logs", key=f"clear_logs_{p_id}_{dev_phone}", use_container_width=True):
                                                        if clear_session_logs(device_sess_id):
                                                            st.toast("Logs cleared successfully.")
                                                        else:
                                                            st.toast("No logs to clear.")

                                                # Read and display logs
                                                log_lines = read_session_logs(device_sess_id, max_lines=100)

                                                if not log_lines:
                                                    st.info("No logs available for this device. Logs will appear once the device is connected and processing messages.")
                                                else:
                                                    # Display logs in a scrollable code block
                                                    log_text = "\n".join(log_lines)

                                                    # Copy logs button using custom HTML/JS
                                                    import urllib.parse
                                                    encoded_logs = urllib.parse.quote(log_text)
                                                    copy_btn_html = f"""
                                                    <div style="display: flex; justify-content: flex-end; margin-bottom: -10px;">
                                                        <button id="copyBtn" style="
                                                            background-color: #2b2b36;
                                                            color: #f4f4f4;
                                                            border: 1px solid #444;
                                                            padding: 6px 12px;
                                                            border-radius: 6px;
                                                            cursor: pointer;
                                                            font-size: 13px;
                                                            font-family: system-ui, -apple-system, sans-serif;
                                                            display: flex;
                                                            align-items: center;
                                                            gap: 6px;
                                                            transition: background-color 0.2s;
                                                        " onclick="copyLogs()">
                                                            📋 Copy Logs
                                                        </button>
                                                        <textarea id="logText" style="display:none;"></textarea>
                                                    </div>
                                                    <script>
                                                    function copyLogs() {{
                                                        const text = decodeURIComponent("{encoded_logs}");
                                                        const textArea = document.getElementById("logText");
                                                        textArea.style.display = "block";
                                                        textArea.value = text;
                                                        textArea.select();
                                                        try {{
                                                            document.execCommand("copy");
                                                            const btn = document.getElementById("copyBtn");
                                                            btn.innerHTML = "✅ Copied!";
                                                            btn.style.backgroundColor = "#1b4d3e";
                                                            setTimeout(() => {{
                                                                btn.innerHTML = "📋 Copy Logs";
                                                                btn.style.backgroundColor = "#2b2b36";
                                                            }}, 2000);
                                                        }} catch (err) {{
                                                            alert("Could not copy: " + err);
                                                        }}
                                                        textArea.style.display = "none";
                                                    }}
                                                    </script>
                                                    """
                                                    import streamlit.components.v1 as components
                                                    components.html(copy_btn_html, height=45)

                                                    st.code(log_text, language="text")
                                                    st.caption(f"Showing last {len(log_lines)} log entries. Logs auto-refresh every 2 seconds.")

                                        st.write("---")

                                        col_cache, col_unlink = st.columns([1, 1])
                                        with col_cache:
                                            if st.button("🧹 Clear Cache", key=f"clear_cache_dev_{p_id}_{dev_phone}", use_container_width=True):
                                                for scan_name in device_scans:
                                                    flag_path = f"data/clear-cache-{scan_name}.flag"
                                                    try:
                                                        with open(flag_path, "w") as f:
                                                            f.write("clear")
                                                    except Exception:
                                                        pass
                                                st.toast(f"Cache clear requested for active scan(s) on +{dev_phone}.")
                                        with col_unlink:
                                            if st.button("Unlink Device", key=f"unlink_{p_id}_{dev_phone}", use_container_width=True):
                                                for scan_name in device_scans:
                                                    try:
                                                        if os.name == 'nt':
                                                            subprocess.run(['taskkill', '/F', '/T', '/PID', str(running_instances[scan_name]['pid'])], capture_output=True)
                                                        else:
                                                            os.kill(running_instances[scan_name]['pid'], signal.SIGTERM)
                                                        del running_instances[scan_name]
                                                    except Exception:
                                                        pass
                                                save_running_processes(running_instances)

                                                try:
                                                    import shutil
                                                    shutil.rmtree(f".wwebjs_auth/session-session_{p_id}_dev_{dev_phone}", ignore_errors=True)
                                                except Exception:
                                                    pass

                                                # Also clear status and logs on unlink
                                                try:
                                                    os.remove(f"data/status-{device_sess_id}.json")
                                                except FileNotFoundError:
                                                    pass
                                                clear_session_logs(device_sess_id)

                                                del p_info["devices"][dev_phone]
                                                save_profiles(profiles)
                                                st.toast("Device unlinked successfully.")
                                                time.sleep(1)
                                                st.rerun()

                render_linked_devices_fragment(p_id, p_info, profiles, running_instances)
                st.write("---")
                
                # Fetch persistent unassigned scans
                created_scans = load_created_scans()
                user_configured_scans = created_scans.get(p_id, {})
                
                st.markdown("### 🆕 Configured Scans Pool (Pills)")
                
                active_focus = st.session_state.focused_scan.get(p_id, None)
                add_scan_open = st.session_state.show_add_scan.get(p_id, False)
                
                if not user_configured_scans:
                    st.info("No configured scans available. Click '➕ Add Scan' below to create a new scan pill.")
                    
                    # Single Add Scan trigger pill
                    if st.button("➕ Add Scan", key=f"plus_empty_{p_id}", type="primary"):
                        st.session_state.show_add_scan[p_id] = True
                        st.session_state.focused_scan[p_id] = None
                        st.rerun()
                else:
                    tag_col_count = len(user_configured_scans) + 1
                    tag_cols = st.columns(min(tag_col_count, 6))
                    
                    # Render active scan pills
                    for idx, scan_name in enumerate(sorted(user_configured_scans.keys())):
                        col_idx = idx % min(tag_col_count, 6)
                        with tag_cols[col_idx]:
                            is_focused = (active_focus == scan_name)
                            if st.button(
                                f"🏷️ {scan_name}", 
                                key=f"tag_{p_id}_{scan_name}", 
                                type="primary" if is_focused else "secondary",
                                use_container_width=True
                            ):
                                if is_focused:
                                    st.session_state.focused_scan[p_id] = None
                                else:
                                    st.session_state.focused_scan[p_id] = scan_name
                                    st.session_state.show_add_scan[p_id] = False
                                st.rerun()
                                
                    # Render the "+" button
                    plus_col_idx = len(user_configured_scans) % min(tag_col_count, 6)
                    with tag_cols[plus_col_idx]:
                        if st.button(
                            "➕ Add Scan", 
                            key=f"plus_{p_id}", 
                            type="primary" if add_scan_open else "secondary",
                            use_container_width=True
                        ):
                            st.session_state.show_add_scan[p_id] = not add_scan_open
                            st.session_state.focused_scan[p_id] = None
                            st.rerun()
                            
                # Render Inline Scan Details / Device Assignment widget if pill focused
                if active_focus and active_focus in user_configured_scans:
                    scan_cfg = user_configured_scans[active_focus]
                    
                    st.write("")
                    with st.container(border=True):
                        st.markdown(f"#### 🏷️ Configure & Activate Scan: `{active_focus}`")
                        det_cols = st.columns([3, 1])
                        with det_cols[0]:
                            source_mode_disp = scan_cfg.get("sourceMode", "individual,groups,channels")
                            target_phone_disp = p_info.get("target_phone") or "Default (Self/Scanning Device)"
                            st.markdown(f"""
                            * **Pipeline Category:** {scan_cfg['category']}
                            * **Pipeline Template:** `{scan_cfg['template']}`
                            * **Message Sources:** `{source_mode_disp}`
                            * **Notification Target:** `{target_phone_disp}`
                            """)
                            if "individual" in source_mode_disp:
                                st.markdown(f"* **Chats Whitelist:** `{scan_cfg.get('chats') or 'All direct chats'}`")
                            if "groups" in source_mode_disp:
                                st.markdown(f"* **Groups Whitelist:** `{scan_cfg.get('groups') or 'All groups'}`")
                            if "channels" in source_mode_disp:
                                st.markdown(f"* **Channels Whitelist:** `{scan_cfg.get('channels') or 'All channels'}`")
                            
                            # Check if scan is active on any device
                            matching_instances = [name for name, info in running_instances.items() if info.get("profileId") == p_id and info.get("template") == scan_cfg["template"] and (name == active_focus or name.startswith(active_focus + "_"))]
                            
                            if matching_instances:
                                running_phones = [
                                    running_instances[n].get('devicePhone') or running_instances[n].get('phone') or 'Unknown'
                                    for n in matching_instances
                                ]
                                st.success(f"This scan is currently active on device(s): **{', '.join(running_phones)}**")
                            else:
                                st.info("This scan pill is currently unassigned (dormant). Select a linked device below to activate it.")
                                
                        with det_cols[1]:
                            if st.button("Delete Scan Pill", key=f"del_pill_{p_id}_{active_focus}", use_container_width=True, type="secondary"):
                                del created_scans[p_id][active_focus]
                                save_created_scans(created_scans)
                                st.session_state.focused_scan[p_id] = None
                                st.toast(f"Scan '{active_focus}' deleted from pool.")
                                time.sleep(1)
                                st.rerun()
                                
                        if not matching_instances:
                            st.write("---")
                            if not p_info.get("gemini_key"):
                                st.error("⚠️ **Gemini API Key is missing!** You must configure a Gemini API key for this profile before you can activate a scan. Please click **Edit** at the top of the card to configure your API keys.")
                            elif not devices:
                                st.warning("You must link a WhatsApp device to this profile first before you can activate this scan.")
                            else:
                                activation_col1, activation_col2 = st.columns([3, 1])
                                with activation_col1:
                                    selected_device_phone = st.selectbox(
                                        "Select Device to Activate Scan On",
                                        options=list(devices.keys()),
                                        format_func=lambda x: f"📱 +{x} ({len(devices[x].get('channels', []))} channels)",
                                        key=f"activate_device_{p_id}_{active_focus}"
                                    )
                                with activation_col2:
                                    st.write(" ")
                                    if st.button("🚀 Activate Scan", key=f"btn_activate_{p_id}_{active_focus}", type="primary", use_container_width=True):
                                        device_sess_id = f"session_{p_id}_dev_{selected_device_phone}"
                                        actual_scan_name = active_focus
                                        
                                        # Auto-suffix name if conflict occurs
                                        if actual_scan_name in running_instances:
                                            suffix = 2
                                            candidate_name = f"{actual_scan_name}_{suffix}"
                                            while candidate_name in running_instances:
                                                suffix += 1
                                                candidate_name = f"{actual_scan_name}_{suffix}"
                                            actual_scan_name = candidate_name
                                            
                                        cmd = [
                                            "node", "src/launcher.js",
                                            "--template", scan_cfg["template"],
                                            "--instance", actual_scan_name,
                                            "--sessionId", device_sess_id
                                        ]
                                        
                                        # Pass sourceMode, channels, groups, and chats if present
                                        src_mode = scan_cfg.get("sourceMode")
                                        if src_mode:
                                            cmd.extend(["--sourceMode", src_mode])
                                        if scan_cfg.get("channels"):
                                            cmd.extend(["--channels", scan_cfg["channels"]])
                                        if scan_cfg.get("groups"):
                                            cmd.extend(["--groups", scan_cfg["groups"]])
                                        if scan_cfg.get("chats"):
                                            cmd.extend(["--chats", scan_cfg["chats"]])
                                            
                                        notification_target = p_info.get("target_phone") or selected_device_phone
                                        cmd.extend(["--phone", notification_target])

                                        custom_env = os.environ.copy()
                                        custom_env.update({
                                            "GEMINI_API_KEY": p_info["gemini_key"],
                                            "JINA_API_KEY": p_info.get("jina_key", ""),
                                            "APPLICANT_NAME": p_info["applicant_name"],
                                            "APPLICANT_NATIONALITY": p_info["applicant_nationality"],
                                            "APPLICANT_DEGREE_TIER": p_info["applicant_degree_tier"],
                                            "APPLICANT_TARGET_FIELDS": p_info["applicant_target_fields"],
                                            "APPLICANT_RESEARCH_FOCUS": p_info.get("applicant_focus", "")
                                        })
                                        # Reset the status file to prevent rendering stale previous statuses
                                        status_path = f"data/status-{device_sess_id}.json"
                                        try:
                                            with open(status_path, "w") as f:
                                                json.dump({
                                                    "status": "CONNECTING",
                                                    "reason": "Starting background daemon..."
                                                }, f)
                                        except Exception:
                                            pass

                                        try:
                                            daemon_log = open(f"data/daemon-{actual_scan_name}.log", "a", encoding="utf-8")
                                            p = subprocess.Popen(
                                                cmd,
                                                stdout=daemon_log,
                                                stderr=subprocess.STDOUT,
                                                env=custom_env,
                                                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
                                            )
                                            
                                            running_instances[actual_scan_name] = {
                                                "pid": p.pid,
                                                "template": scan_cfg["template"],
                                                "category": scan_cfg["category"],
                                                "sessionId": device_sess_id,
                                                "profileId": p_id,
                                                "profileName": p_info["name"],
                                                "channels": scan_cfg.get("channels", ""),
                                                "groups": scan_cfg.get("groups", ""),
                                                "chats": scan_cfg.get("chats", ""),
                                                "sourceMode": scan_cfg.get("sourceMode", "individual,groups,channels"),
                                                "phone": notification_target,
                                                "devicePhone": selected_device_phone,
                                                "startedAt": time.strftime("%Y-%m-%d %H:%M:%S")
                                            }
                                            save_running_processes(running_instances)
                                            
                                            st.success(f"Scan '{actual_scan_name}' activated on device +{selected_device_phone}.")
                                            st.session_state.focused_scan[p_id] = None
                                            time.sleep(1)
                                            st.rerun()
                                        except Exception as e:
                                            st.error(f"Failed to launch scan process: {e}")
                                            
                # Render Inline Add Scan Configurator Form if open
                if add_scan_open:
                    st.write("")
                    with st.container(border=True):
                        st.markdown("### 🚀 Create Configured Scan Pill")
                        
                        # Aggregate verified channels, groups, and chats across all linked devices
                        combined_verified_channels = []
                        combined_verified_groups = []
                        combined_verified_chats = []
                        for dev_phone, dev_info in devices.items():
                            combined_verified_channels.extend(dev_info.get("channels", []))
                            combined_verified_groups.extend(dev_info.get("groups", []))
                            combined_verified_chats.extend(dev_info.get("chats", []))
                        combined_verified_channels = sorted(list(set(combined_verified_channels)))
                        combined_verified_groups = sorted(list(set(combined_verified_groups)))
                        combined_verified_chats = sorted(list(set(combined_verified_chats)))
                        
                        scan_mode = st.radio(
                             "Choose Scan Configuration Method",
                             ["Select Predefined Scan", "Create Custom Scan"],
                             horizontal=True,
                             key=f"scan_mode_{p_id}"
                        )
                        
                        if scan_mode == "Select Predefined Scan":
                            selected_predef_key = st.selectbox(
                                "Available Opportunity Scans",
                                options=list(PREDEFINED_SCANS.keys()),
                                format_func=lambda x: PREDEFINED_SCANS[x]["name"],
                                key=f"predef_select_{p_id}",
                                help="Choose a preconfigured scan targeting popular academic or job channels."
                            )
                            selected_scan_info = PREDEFINED_SCANS[selected_predef_key]
                            
                            with st.container(border=True):
                                st.markdown(f"**Description:** {selected_scan_info['description']}")
                                st.markdown(f"**Pipeline Category:** `{selected_scan_info['category']}`")
                                st.markdown(f"**Channels to Monitor:** `{selected_scan_info['channels']}`")
                            
                            inline_category = selected_scan_info["category"]
                            inline_template = selected_scan_info["template"]
                            inline_scan_name = selected_predef_key
                            inline_channels = selected_scan_info["channels"]
                            inline_groups = ""
                            inline_chats = ""
                            chat_mode = "Disabled"
                            group_mode = "Disabled"
                            channel_mode = "Selected Only"
                            
                        else:
                            inline_category = st.selectbox(
                                "Select Opportunity Pipeline",
                                ["Scholarships Discovery", "Job Search & Match"],
                                key=f"inline_cat_{p_id}",
                                help="Select the classification type of opportunities you want to search and evaluate."
                            )
                            inline_template = "scholarships" if inline_category == "Scholarships Discovery" else "jobs"
                            
                            inline_scan_name = st.text_input(
                                "Name this Scan",
                                placeholder="e.g. scholarship_europe, jobs_germany",
                                key=f"inline_name_{p_id}",
                                help="A unique name to identify this scan instance."
                            ).strip().replace(" ", "_")
                            
                            st.markdown("##### ⚙️ Configure Message Sources")
                            src_col1, src_col2, src_col3 = st.columns(3)
                            with src_col1:
                                chat_mode = st.selectbox(
                                    "💬 Individual Chats",
                                    ["All", "Selected Only", "Disabled"],
                                    index=0,
                                    key=f"chat_mode_{p_id}",
                                    help="Configure direct messages to scan."
                                )
                            with src_col2:
                                group_mode = st.selectbox(
                                    "👥 Groups",
                                    ["All", "Selected Only", "Disabled"],
                                    index=0,
                                    key=f"group_mode_{p_id}",
                                    help="Configure group chats to scan."
                                )
                            with src_col3:
                                channel_mode = st.selectbox(
                                    "📡 Channels",
                                    ["All", "Selected Only", "Disabled"],
                                    index=0,
                                    key=f"channel_mode_{p_id}",
                                    help="Configure channel posts to scan."
                                )

                            # Whitelist fields
                            inline_chats = ""
                            inline_groups = ""
                            inline_channels = ""

                            if chat_mode == "Selected Only":
                                if combined_verified_chats:
                                    selected_chats = st.multiselect(
                                        "Select Chats to Monitor",
                                        options=combined_verified_chats,
                                        key=f"inline_chats_sel_{p_id}",
                                        help="Select direct chats known to your devices."
                                    )
                                    inline_chats = ", ".join(selected_chats)
                                else:
                                    inline_chats = st.text_area(
                                        "Specify Chats to Monitor (Comma separated)",
                                        placeholder="e.g. 923217744858, John Doe",
                                        key=f"inline_chats_text_{p_id}",
                                        help="Specify names or phone numbers manually."
                                    )

                            if group_mode == "Selected Only":
                                if combined_verified_groups:
                                    selected_groups = st.multiselect(
                                        "Select Groups to Monitor",
                                        options=combined_verified_groups,
                                        key=f"inline_groups_sel_{p_id}",
                                        help="Select groups known to your devices."
                                    )
                                    inline_groups = ", ".join(selected_groups)
                                else:
                                    inline_groups = st.text_area(
                                        "Specify Groups to Monitor (Comma separated)",
                                        placeholder="e.g. Scholarship Group, 120363023456789@g.us",
                                        key=f"inline_groups_text_{p_id}",
                                        help="Specify names or group IDs manually."
                                    )

                            if channel_mode == "Selected Only":
                                if combined_verified_channels:
                                    selected_channels = st.multiselect(
                                        "Select Channels to Monitor",
                                        options=combined_verified_channels,
                                        key=f"inline_channels_sel_{p_id}",
                                        help="Select channels known to your devices."
                                    )
                                    inline_channels = ", ".join(selected_channels)
                                else:
                                    inline_channels = st.text_area(
                                        "WhatsApp Channels to Monitor (Comma separated)",
                                        placeholder="e.g. Scholarship Alerts, 120363023456789@newsletter",
                                        key=f"inline_channels_text_{p_id}",
                                        help="Specify channel names or IDs manually."
                                    )
                                
                        btn_cols = st.columns([5, 1, 1])
                        with btn_cols[1]:
                            if st.button("Cancel", key=f"cancel_launch_{p_id}", use_container_width=True):
                                st.session_state.show_add_scan[p_id] = False
                                st.rerun()
                        with btn_cols[2]:
                            if st.button("Create", key=f"create_inline_{p_id}", type="primary", use_container_width=True):
                                if not inline_scan_name:
                                    st.error("Please enter a name for this scan.")
                                else:
                                    created_scans = load_created_scans()
                                    if p_id not in created_scans:
                                        created_scans[p_id] = {}
                                    
                                    if scan_mode == "Select Predefined Scan":
                                        source_mode_str = "channels"
                                        final_chats = ""
                                        final_groups = ""
                                        final_channels = inline_channels
                                    else:
                                        src_mode_list = []
                                        if chat_mode != "Disabled":
                                            src_mode_list.append("individual")
                                        if group_mode != "Disabled":
                                            src_mode_list.append("groups")
                                        if channel_mode != "Disabled":
                                            src_mode_list.append("channels")
                                        source_mode_str = ",".join(src_mode_list) if src_mode_list else "individual,groups,channels"
                                        
                                        final_chats = inline_chats if chat_mode == "Selected Only" else ""
                                        final_groups = inline_groups if group_mode == "Selected Only" else ""
                                        final_channels = inline_channels if channel_mode == "Selected Only" else ""

                                    created_scans[p_id][inline_scan_name] = {
                                        "name": inline_scan_name,
                                        "category": inline_category,
                                        "template": inline_template,
                                        "sourceMode": source_mode_str,
                                        "channels": final_channels,
                                        "groups": final_groups,
                                        "chats": final_chats
                                    }
                                    save_created_scans(created_scans)
                                    st.success(f"Scan pill '{inline_scan_name}' added to pool successfully.")
                                    st.session_state.show_add_scan[p_id] = False
                                    time.sleep(1)
                                    st.rerun()

else:
    # Create / Edit Form View
    is_new = (editing_profile == "new")
    
    if is_new:
        st.subheader("➕ Create New Applicant Profile")
        default_name = ""
        default_gemini = ""
        default_jina = ""
        default_app_name = ""
        default_app_nationality = ""
        default_app_degree = ""
        default_app_fields = ""
        default_app_focus = ""
    else:
        p_info = profiles[editing_profile]
        st.subheader(f"✏️ Edit Profile: {p_info['name']}")
        default_name = p_info["name"]
        default_gemini = p_info["gemini_key"]
        default_jina = p_info.get("jina_key", "")
        default_app_name = p_info["applicant_name"]
        default_app_nationality = p_info["applicant_nationality"]
        default_app_degree = p_info["applicant_degree_tier"]
        default_app_fields = p_info["applicant_target_fields"]
        default_app_focus = p_info.get("applicant_focus", p_info.get("applicant_research_focus", ""))
        
    with st.container(border=True):
        profile_display_name = st.text_input(
            "Profile / Customer Display Name",
            value=default_name,
            placeholder="e.g. John Doe"
        ).strip()
        
        form_col1, form_col2 = st.columns([1, 1])
        
        with form_col1:
            st.markdown("### 🔑 API Authentication")
            gemini_key = st.text_input(
                "Google Gemini API Key",
                value=default_gemini,
                type="password"
            )
            jina_key = st.text_input(
                "Jina Reader API Key (Optional)",
                value=default_jina,
                type="password"
            )
            
            st.markdown("### 🔔 Notification Settings")
            # Parse country code and number from target_phone
            default_cc = "+92"
            default_phone_num = ""
            default_custom_cc = "+"
            if not is_new:
                target_phone_val = p_info.get("target_phone", "")
                if target_phone_val:
                    target_phone_val = target_phone_val.replace(" ", "").replace("-", "")
                    # Match standard codes
                    for cc in ["+92", "+1", "+44", "+91", "+971", "+966", "+49", "+61"]:
                        if target_phone_val.startswith(cc):
                            default_cc = cc
                            default_phone_num = target_phone_val[len(cc):]
                            break
                        elif target_phone_val.startswith(cc[1:]):
                            default_cc = cc
                            default_phone_num = target_phone_val[len(cc)-1:]
                            break
                    else:
                        if target_phone_val.startswith("+"):
                            import re
                            m = re.match(r"^(\+\d{1,4})(.*)$", target_phone_val)
                            if m:
                                default_cc = "Other"
                                default_custom_cc = m.group(1)
                                default_phone_num = m.group(2)
                            else:
                                default_cc = "Other"
                                default_custom_cc = "+"
                                default_phone_num = target_phone_val
                        else:
                            if target_phone_val.startswith("92") and len(target_phone_val) > 10:
                                default_cc = "+92"
                                default_phone_num = target_phone_val[2:]
                            else:
                                default_cc = "+92"
                                default_phone_num = target_phone_val
            
            cc_options = ["+92", "+1", "+44", "+91", "+971", "+966", "+49", "+61", "Other"]
            cc_index = cc_options.index(default_cc) if default_cc in cc_options else 8
            
            cc_col, num_col = st.columns([1, 2])
            with cc_col:
                selected_cc = st.selectbox(
                    "Code",
                    options=cc_options,
                    index=cc_index,
                    key=f"profile_cc_{editing_profile}"
                )
                if selected_cc == "Other":
                    custom_cc = st.text_input("Code Value", value=default_custom_cc, key=f"profile_custom_cc_{editing_profile}")
                    country_code = custom_cc.strip()
                else:
                    country_code = selected_cc
            with num_col:
                phone_input = st.text_input(
                    "Target Phone",
                    value=default_phone_num,
                    placeholder="e.g. 3225522383",
                    key=f"profile_phone_{editing_profile}",
                    help="Phone number to receive matching opportunity notifications via WhatsApp."
                ).strip()
            
            target_phone = f"{country_code}{phone_input}".replace(" ", "").replace("-", "")
            
        with form_col2:
            st.markdown("### 🧑‍💼 Applicant Evaluation Parameters")
            app_name = st.text_input("Full Name", value=default_app_name)
            app_nationality = st.text_input("Nationality", value=default_app_nationality)
            app_degree = st.text_input("Degree Tier & Grades", value=default_app_degree)
            app_fields = st.text_area("Target Fields of Study", value=default_app_fields)
            app_focus = st.text_area("Research Focus / Key Interests", value=default_app_focus)
            
        st.write("---")
        act_cols = st.columns([6, 1, 1])
        with act_cols[1]:
            if st.button("Cancel", use_container_width=True):
                del st.session_state.editing_profile
                st.rerun()
        with act_cols[2]:
            if st.button("Save", type="primary", use_container_width=True):
                if is_new:
                    if not profile_display_name:
                        st.error("Please enter a Profile name.")
                    else:
                        p_id = profile_display_name.lower().strip().replace(" ", "_")
                        p_id = "".join(c for c in p_id if c.isalnum() or c == "_")
                        
                        if p_id in profiles:
                            st.error("A profile with this name already exists.")
                        else:
                            profiles[p_id] = {
                                "id": p_id,
                                "name": profile_display_name,
                                "gemini_key": gemini_key,
                                "jina_key": jina_key,
                                "applicant_name": app_name,
                                "applicant_nationality": app_nationality,
                                "applicant_degree_tier": app_degree,
                                "applicant_target_fields": app_fields,
                                "applicant_focus": app_focus,
                                "target_phone": target_phone,
                                "devices": {}
                            }
                            save_profiles(profiles)
                            st.toast(f"Profile '{profile_display_name}' created.")
                            del st.session_state.editing_profile
                            time.sleep(1)
                            st.rerun()
                else:
                    if not profile_display_name:
                        st.error("Please enter a Profile name.")
                    else:
                        existing_devices = profiles[editing_profile].get("devices", {})
                        profiles[editing_profile] = {
                            "id": editing_profile,
                            "name": profile_display_name,
                            "gemini_key": gemini_key,
                            "jina_key": jina_key,
                            "applicant_name": app_name,
                            "applicant_nationality": app_nationality,
                            "applicant_degree_tier": app_degree,
                            "applicant_target_fields": app_fields,
                            "applicant_focus": app_focus,
                            "target_phone": target_phone,
                            "devices": existing_devices
                        }
                        save_profiles(profiles)
                        st.toast("Profile changes saved.")
                        del st.session_state.editing_profile
                        time.sleep(1)
                        st.rerun()
