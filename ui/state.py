import os
import json
import time
import signal
import subprocess
import streamlit as st

# State files paths
PROCESS_FILE = "data/processes.json"
PROFILE_FILE = "data/profiles.json"
CREATED_SCANS_FILE = "data/created_scans.json"

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

def perform_server_startup_cleanup():
    # Kill any stale node/chrome processes from previous runs on server start
    kill_zombie_node_chrome_processes()
    try:
        if os.path.exists(PROCESS_FILE):
            with open(PROCESS_FILE, "w") as f:
                json.dump({}, f)
    except Exception:
        pass
    return True

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

def load_scan_history(scan_name):
    history_path = f"data/history-{scan_name}.json"
    if os.path.exists(history_path):
        try:
            with open(history_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception:
            return []
    return []
