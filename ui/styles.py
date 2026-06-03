import streamlit as st

def apply_custom_styles():
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

        /* Design System Tokens */
        :root {
            --bg-page: #212121;
            --bg-level-1: #2B2B2B;
            --bg-level-2: #1E1E1E;
            --bg-level-3: #121212;

            --border-level-1: #2D2D2D;
            --border-level-2: #3E3E3E;
            --border-level-3: #4A4A4A;

            --text-color: #FFFFFF;
            --text-muted: #8E9297;
            --whatsapp-green: #25D366;
            --whatsapp-green-hover: #20ba5a;
            --whatsapp-green-alpha: rgba(37, 211, 102, 0.06);
            --whatsapp-green-border: rgba(37, 211, 102, 0.15);
        }

        /* Global style overrides */
        html, body, [class*="css"], .stApp {
            font-family: 'Inter', sans-serif !important;
            background-color: var(--bg-page) !important;
            color: var(--text-color) !important;
        }

        /* Streamlit top header & decoration bar */
        header[data-testid="stHeader"] {
            background-color: var(--bg-page) !important;
            border-bottom: 1px solid var(--border-level-1) !important;
        }

        header[data-testid="stHeader"] * {
            color: var(--text-color) !important;
        }

        div[data-testid="stDecoration"] {
            background-image: linear-gradient(90deg, var(--whatsapp-green), var(--whatsapp-green-hover)) !important;
        }

        h1, h2, h3, h4, h5, h6 {
            font-family: 'Outfit', sans-serif !important;
            color: var(--text-color) !important;
            font-weight: 700 !important;
        }

        /* Subheader and special section spacing */
        .stSubheader h3 {
            border-bottom: 2px solid var(--border-level-1);
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
            color: var(--text-color) !important;
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
            border-left: 3px solid var(--whatsapp-green) !important;
            border-radius: 8px !important;
            padding: 12px 16px !important;
            margin-top: 20px !important;
        }

        [data-testid="stSidebar"] div[data-testid="stAlert"] div {
            color: var(--text-muted) !important;
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
            color: var(--text-muted) !important;
            margin-bottom: 8px !important;
            padding: 12px 16px !important;
            font-weight: 500 !important;
            font-size: 14px !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        [data-testid="stSidebar"] div.stButton > button:hover {
            border-color: rgba(255, 255, 255, 0.05) !important;
            border-left: 4px solid rgba(37, 211, 102, 0.5) !important;
            color: var(--text-color) !important;
            background-color: rgba(255, 255, 255, 0.02) !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
            transform: translateX(4px) !important;
        }

        /* Sidebar active primary navigation buttons */
        [data-testid="stSidebar"] div.stButton > button[kind="primary"] {
            background-color: var(--whatsapp-green-alpha) !important;
            color: var(--whatsapp-green) !important;
            border: 1px solid var(--whatsapp-green-border) !important;
            border-left: 4px solid var(--whatsapp-green) !important;
            border-radius: 6px !important;
            font-weight: 600 !important;
            font-size: 14px !important;
            box-shadow: inset 0 0 10px rgba(37, 211, 102, 0.05), 0 4px 12px rgba(0, 0, 0, 0.2) !important;
            transform: translateX(4px) !important;
        }

        [data-testid="stSidebar"] div.stButton > button[kind="primary"]:hover {
            background-color: rgba(37, 211, 102, 0.1) !important;
            color: var(--whatsapp-green) !important;
            border-color: rgba(37, 211, 102, 0.25) !important;
            border-left: 4px solid var(--whatsapp-green) !important;
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

        /* -------------------------------------------------------------
           LEVEL 1 CONTAINERS (Profile Cards, Expander list items)
           ------------------------------------------------------------- */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] {
            border: 1px solid var(--border-level-1) !important;
            border-radius: 14px !important;
            background-color: var(--bg-level-1) !important;
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25) !important;
            padding: 24px !important;
            margin-bottom: 20px !important;
            transition: border-color 0.2s ease-in-out !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"]:hover {
            border-color: var(--border-level-2) !important;
        }

        /* Level 1 Expander details & summary styling */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] > details {
            border: none !important;
            background: transparent !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] summary {
            background-color: var(--bg-level-1) !important;
            color: var(--text-color) !important;
            font-family: 'Outfit', sans-serif !important;
            font-weight: 700 !important;
            font-size: 1.15rem !important;
            padding: 16px 20px !important;
            border-radius: 14px !important;
            transition: color 0.2s ease-in-out !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] summary:hover {
            color: var(--whatsapp-green) !important;
        }
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] summary:hover svg {
            color: var(--whatsapp-green) !important;
            fill: currentColor !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] details[open] summary {
            border-bottom: 1px solid var(--border-level-1) !important;
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
        }

        /* -------------------------------------------------------------
           LEVEL 2 CONTAINERS (Device cards, Sub-sections inside Level 1)
           ------------------------------------------------------------- */
        /* Style for device header toggle buttons to look like expanders */
        div[class*="st-key-dev_hdr_btn"] button {
            background-color: var(--bg-level-2) !important;
            color: var(--text-color) !important;
            border: 1px solid var(--border-level-2) !important;
            border-radius: 10px !important;
            text-align: left !important;
            justify-content: flex-start !important;
            font-family: 'Outfit', sans-serif !important;
            font-weight: 600 !important;
            padding: 10px 14px !important;
            margin-bottom: -10px !important;
        }

        div[class*="st-key-dev_hdr_btn"] button:hover {
            color: var(--whatsapp-green) !important;
            border-color: var(--whatsapp-green) !important;
            background-color: var(--border-level-1) !important;
        }

        /* Nested containers (subsections / sub-cards, Level 2) styling */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] {
            background-color: var(--bg-level-2) !important;
            border: 1px solid var(--border-level-2) !important;
            border-radius: 10px !important;
            box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3) !important;
            padding: 20px !important;
            margin-top: 10px !important;
            margin-bottom: 10px !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover {
            border-color: var(--whatsapp-green) !important;
            box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(37, 211, 102, 0.1) !important;
        }

        /* Expanders inside Level 1 (e.g. log expanders) */
        div[data-testid="stExpander"] div[data-testid="stExpander"] {
            background-color: var(--bg-level-2) !important;
            border: 1px solid var(--border-level-2) !important;
            border-radius: 10px !important;
        }
        
        div[data-testid="stExpander"] div[data-testid="stExpander"] summary {
            background-color: var(--bg-level-2) !important;
            border-radius: 10px !important;
            padding: 10px 14px !important;
            font-size: 1rem !important;
        }

        /* -------------------------------------------------------------
           LEVEL 3 CONTAINERS (Inner alert panels, code displays, log blocks)
           ------------------------------------------------------------- */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] {
            background-color: var(--bg-level-3) !important;
            border: 1px solid var(--border-level-3) !important;
            box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.5) !important;
            padding: 16px !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover {
            border-color: var(--whatsapp-green) !important;
            box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(37, 211, 102, 0.15) !important;
        }

        /* Buttons global overrides */
        button {
            border-radius: 8px !important;
            font-weight: 500 !important;
            transition: all 0.2s ease-in-out !important;
        }

        button[kind="primary"] {
            background-color: var(--whatsapp-green) !important;
            color: #121212 !important;
            border: 1px solid var(--whatsapp-green) !important;
        }

        button[kind="primary"]:hover {
            background-color: var(--whatsapp-green-hover) !important;
            color: #121212 !important;
            box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3) !important;
            transform: translateY(-1px);
        }

        button[kind="secondary"] {
            background-color: #2D2D2D !important;
            color: var(--text-color) !important;
            border: 1px solid #3E3E3E !important;
        }

        button[kind="secondary"]:hover {
            border-color: var(--whatsapp-green) !important;
            color: var(--whatsapp-green) !important;
            background-color: #333333 !important;
            box-shadow: 0 2px 8px rgba(37, 211, 102, 0.1) !important;
        }

        /* Input & form fields styling */
        div[data-baseweb="input"], div[data-baseweb="textarea"], div[data-baseweb="select"] {
            background-color: var(--bg-level-2) !important;
            border: 1px solid var(--border-level-1) !important;
            border-radius: 8px !important;
            color: var(--text-color) !important;
        }

        /* Inputs inside Level 2 container should be darker */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="input"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="input"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="textarea"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="textarea"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="select"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="select"] {
            background-color: var(--bg-level-3) !important;
            border-color: var(--border-level-2) !important;
        }

        input, textarea, select {
            color: var(--text-color) !important;
            background-color: transparent !important;
        }

        div[data-baseweb="input"]:focus-within, div[data-baseweb="textarea"]:focus-within, div[data-baseweb="select"]:focus-within {
            border-color: var(--whatsapp-green) !important;
            box-shadow: 0 0 0 1px var(--whatsapp-green) !important;
        }

        /* Multi-select tag bubble styles */
        span[role="button"] {
            background-color: #2D2D2D !important;
            border: 1px solid #3E3E3E !important;
            color: var(--text-color) !important;
        }

        /* Alerts styling (info, success, warning, error) */
        div[data-testid="stAlert"] {
            background-color: var(--bg-level-1) !important;
            border: 1px solid var(--border-level-1) !important;
            border-radius: 10px !important;
        }

        div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stAlert"] {
            background-color: var(--bg-level-2) !important;
            border-color: var(--border-level-2) !important;
        }

        div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stAlert"],
        div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stAlert"] {
            background-color: var(--bg-level-3) !important;
            border-color: var(--border-level-3) !important;
        }

        /* Logs & Code display */
        code {
            color: var(--whatsapp-green) !important;
            background-color: var(--bg-level-3) !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 13.5px !important;
            padding: 2px 6px !important;
            border-radius: 4px !important;
        }

        pre {
            background-color: var(--bg-level-3) !important;
            border: 1px solid var(--border-level-2) !important;
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
            background-color: var(--bg-level-2) !important;
            color: var(--text-color) !important;
            border-left: 5px solid var(--whatsapp-green) !important;
        }

        /* Progress bar coloring */
        div[role="progressbar"] > div {
            background-color: var(--whatsapp-green) !important;
        }

        /* Custom scrollbars */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: var(--bg-page);
        }
        ::-webkit-scrollbar-thumb {
            background: #3E3E3E;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: var(--whatsapp-green);
        }
    </style>
    """, unsafe_allow_html=True)
