import streamlit as st

def apply_custom_styles():
    # Streamlit Page Config & Custom Styling (WhatsApp Dark Theme)
    import base64
    from io import BytesIO
    from PIL import Image

    # Base64 encoded self-contained noria-logo.png
    LOGO_BASE64 = "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"
    logo_img = Image.open(BytesIO(base64.b64decode(LOGO_BASE64)))

    st.set_page_config(
        page_title="Noria — Control Center",
        page_icon=logo_img,
        layout="wide",
        initial_sidebar_state="expanded",
        menu_items={
            'About': '''
# Noria — Control Center
An agentic extractor for messaging platforms.

To run this app:
```bash
streamlit run app.py
```
'''
        }
    )

    # Premium Custom CSS — WhatsApp Dark Theme (#212121 / #25D366 / #FFFFFF)
    # Density-optimized spatial composition with 4px-based spacing scale
    st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap');

        /* =============================================================
           DESIGN SYSTEM TOKENS
           ============================================================= */
        :root {
            /* Backgrounds — 3-tier elevation */
            --bg-page: #212121;
            --bg-level-1: #2B2B2B;
            --bg-level-2: #1E1E1E;
            --bg-level-3: #121212;

            /* Borders — progressive contrast */
            --border-level-1: #2D2D2D;
            --border-level-2: #383838;
            --border-level-3: #444444;

            /* Typography */
            --text-color: #FFFFFF;
            --text-secondary: #B0B3B8;
            --text-muted: #8E9297;
            --text-dim: #6B6E73;

            /* Brand */
            --whatsapp-green: #25D366;
            --whatsapp-green-hover: #20ba5a;
            --whatsapp-green-alpha: rgba(37, 211, 102, 0.06);
            --whatsapp-green-border: rgba(37, 211, 102, 0.15);

            /* Spacing scale (4px base) */
            --space-xs: 6px;
            --space-sm: 10px;
            --space-md: 16px;
            --space-lg: 24px;
            --space-xl: 32px;

            /* Radii */
            --radius-sm: 6px;
            --radius-md: 8px;
            --radius-lg: 10px;
        }

        /* =============================================================
           GLOBAL RESETS & STREAMLIT SPACING OVERRIDES
           ============================================================= */
        html, body, [class*="css"], .stApp {
            font-family: 'Inter', sans-serif !important;
            background-color: var(--bg-page) !important;
            color: var(--text-color) !important;
        }

        /* Reduce Streamlit's default top padding (~6rem → 2.5rem) */
        .block-container {
            padding-top: 2.5rem !important;
            padding-bottom: 1.5rem !important;
        }

        /* Reduce vertical gap between Streamlit elements (default ~1rem → 0.65rem) */
        div[data-testid="stVerticalBlock"] > div {
            margin-bottom: 0.65rem !important;
        }

        /* Give containers and expanders more breathing room */
        div[data-testid="stVerticalBlock"] > div:has(> div[data-testid="stVerticalBlockBorderWrapper"]),
        div[data-testid="stVerticalBlock"] > div:has(> div[data-testid="stExpander"]) {
            margin-bottom: var(--space-lg) !important;
        }

        /* Section headers (h4, h5) get top breathing room for visual separation */
        h4 {
            margin-top: var(--space-lg) !important;
            padding-top: var(--space-sm) !important;
        }
        h5 {
            margin-top: var(--space-md) !important;
            padding-top: var(--space-xs) !important;
        }

        /* Horizontal column gaps — slightly tighter than default */
        div[data-testid="stHorizontalBlock"] {
            gap: var(--space-md) !important;
        }

        /* Markdown paragraph spacing — compact but readable */
        div[data-testid="stMarkdown"] p {
            font-size: 13.5px !important;
            font-weight: 400 !important;
            color: var(--text-color) !important;
            margin-bottom: 8px !important;
            line-height: 1.6 !important;
        }

        /* Caption styling override to fix contrast/opacity issues */
        div[data-testid="stCaptionContainer"] {
            font-size: 12px !important;
            color: var(--text-secondary) !important;
            margin-top: 2px !important;
            margin-bottom: 6px !important;
            line-height: 1.4 !important;
        }

        /* Dividers */
        hr {
            margin-top: var(--space-lg) !important;
            margin-bottom: var(--space-lg) !important;
            border-color: var(--border-level-1) !important;
            opacity: 0.4 !important;
        }


        /* =============================================================
           HEADER & DECORATION
           ============================================================= */
        header[data-testid="stHeader"] {
            background-color: var(--bg-page) !important;
            border-bottom: 1px solid var(--border-level-1) !important;
        }

        header[data-testid="stHeader"] * {
            color: var(--text-color) !important;
        }

        /* Hide Streamlit Community Cloud header clutter (Share, Star, GitHub, Edit links) to match local layout */
        header[data-testid="stHeader"] a {
            display: none !important;
        }
        header[data-testid="stHeader"] button:not([data-testid="stHeaderMenuButton"]):not([aria-label="open user menu"]) {
            display: none !important;
        }

        /* Top signature decoration line */
        div[data-testid="stDecoration"] {
            background-image: linear-gradient(90deg, var(--whatsapp-green), var(--whatsapp-green-hover)) !important;
            height: 4px !important;
            z-index: 999999 !important;
            display: block !important;
            visibility: visible !important;
        }

        /* =============================================================
           TYPOGRAPHY — Tightened scale
           ============================================================= */
        h1 {
            font-family: 'Outfit', sans-serif !important;
            font-size: 24px !important;
            font-weight: 700 !important;
            color: var(--text-color) !important;
            margin-bottom: var(--space-sm) !important;
            line-height: 1.3 !important;
        }

        h2 {
            font-family: 'Outfit', sans-serif !important;
            font-size: 19px !important;
            font-weight: 600 !important;
            color: var(--text-color) !important;
            margin-bottom: var(--space-sm) !important;
            line-height: 1.4 !important;
        }

        h3 {
            font-family: 'Outfit', sans-serif !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            color: var(--text-color) !important;
            margin-bottom: var(--space-xs) !important;
            line-height: 1.4 !important;
        }

        h4 {
            font-family: 'Outfit', sans-serif !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            color: var(--whatsapp-green) !important;
            margin-bottom: var(--space-xs) !important;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            line-height: 1.4 !important;
        }

        h5 {
            font-family: 'Outfit', sans-serif !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            color: var(--text-secondary) !important;
            margin-bottom: var(--space-xs) !important;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            line-height: 1.4 !important;
        }

        h6 {
            font-family: 'Outfit', sans-serif !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            color: var(--text-muted) !important;
            margin-bottom: var(--space-xs) !important;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            line-height: 1.4 !important;
        }

        /* =============================================================
           SIDEBAR
           ============================================================= */
        [data-testid="stSidebar"] {
            background: linear-gradient(180deg, #181818 0%, #0F0F0F 100%) !important;
            border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
        }

        [data-testid="stSidebarContent"] {
            overflow: hidden !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
        }

        [data-testid="stSidebarContent"]::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
        }

        [data-testid="stSidebarUserContent"] {
            height: 100dvh !important;
            max-height: 100dvh !important;
            padding-top: 20px !important;
            padding-bottom: 20px !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
        }

        [data-testid="stSidebarUserContent"] > div[data-testid="stVerticalBlock"] {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            height: 100% !important;
            min-height: 0 !important;
            gap: 0 !important;
            box-sizing: border-box !important;
        }

        [data-testid="stSidebarUserContent"] > div[data-testid="stVerticalBlock"] > div {
            margin-bottom: 0 !important;
        }

        [data-testid="stSidebarUserContent"] > div[data-testid="stVerticalBlock"] > div:has(.st-key-sidebar_bottom_section) {
            margin-top: auto !important;
            padding-top: 24px !important;
        }

        [data-testid="stSidebar"] div.st-key-sidebar_top_section,
        [data-testid="stSidebar"] div.st-key-sidebar_bottom_section {
            width: 100% !important;
            flex: 0 0 auto !important;
        }

        [data-testid="stSidebar"] div.st-key-sidebar_bottom_section {
            margin-top: auto !important;
            padding-top: 24px !important;
        }

        /* Sidebar elements spacing */
        [data-testid="stSidebar"] div.stButton {
            margin-bottom: 0 !important;
        }

        /* =============================================================
           SIDEBAR FOOTER
           ============================================================= */
        .sidebar-footer {
            margin-top: 0px !important;
            border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
            padding-top: 15px !important;
            padding-bottom: 10px !important;
            text-align: center !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 11px !important;
            color: var(--text-muted) !important;
            line-height: 1.45 !important;
        }

        .sidebar-footer a {
            color: var(--whatsapp-green) !important;
            text-decoration: none !important;
            font-weight: 600 !important;
            font-family: 'Outfit', sans-serif !important;
        }

        .sidebar-footer a:hover {
            color: var(--whatsapp-green-hover) !important;
        }

        [data-testid="stSidebar"] *:not(.sidebar-footer):not(.sidebar-footer *) {
            color: var(--text-color) !important;
        }

        [data-testid="stSidebar"],
        [data-testid="stSidebarContent"],
        [data-testid="stSidebarUserContent"] {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
        }

        [data-testid="stSidebar"]::-webkit-scrollbar,
        [data-testid="stSidebarContent"]::-webkit-scrollbar,
        [data-testid="stSidebarUserContent"]::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
        }

        /* Sidebar info boxes */
        [data-testid="stSidebar"] div[data-testid="stAlert"] {
            background: rgba(255, 255, 255, 0.01) !important;
            border: 1px solid rgba(255, 255, 255, 0.04) !important;
            border-left: 3px solid var(--whatsapp-green) !important;
            border-radius: var(--radius-sm) !important;
            padding: var(--space-sm) var(--space-md) !important;
            margin-top: var(--space-md) !important;
        }

        [data-testid="stSidebar"] div[data-testid="stAlert"] div {
            color: var(--text-muted) !important;
            font-size: 12px !important;
            line-height: 1.45 !important;
        }

        /* Sidebar nav buttons (inactive) */
        [data-testid="stSidebar"] div.stButton > button {
            width: 100% !important;
            text-align: left !important;
            border-radius: var(--radius-sm) !important;
            border: 1px solid transparent !important;
            border-left: 3px solid transparent !important;
            background-color: transparent !important;
            color: var(--text-muted) !important;
            margin-bottom: 2px !important;
            padding: var(--space-sm) var(--space-md) !important;
            font-weight: 500 !important;
            font-size: 13px !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        [data-testid="stSidebar"] div.stButton > button:hover {
            border-color: rgba(255, 255, 255, 0.05) !important;
            border-left: 3px solid rgba(37, 211, 102, 0.5) !important;
            color: var(--text-color) !important;
            background-color: rgba(255, 255, 255, 0.02) !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
            transform: translateX(3px) !important;
        }

        /* Sidebar nav active */
        [data-testid="stSidebar"] div.stButton > button[kind="primary"] {
            background-color: var(--whatsapp-green-alpha) !important;
            color: var(--whatsapp-green) !important;
            border: 1px solid var(--whatsapp-green-border) !important;
            border-left: 3px solid var(--whatsapp-green) !important;
            border-radius: var(--radius-sm) !important;
            font-weight: 600 !important;
            font-size: 13px !important;
            box-shadow: inset 0 0 8px rgba(37, 211, 102, 0.04), 0 2px 8px rgba(0, 0, 0, 0.2) !important;
            transform: translateX(3px) !important;
        }

        [data-testid="stSidebar"] div.stButton > button[kind="primary"]:hover {
            background-color: rgba(37, 211, 102, 0.1) !important;
            color: var(--whatsapp-green) !important;
            border-color: rgba(37, 211, 102, 0.25) !important;
            border-left: 3px solid var(--whatsapp-green) !important;
            box-shadow: inset 0 0 8px rgba(37, 211, 102, 0.06), 0 2px 10px rgba(37, 211, 102, 0.12) !important;
            transform: translateX(3px) !important;
        }

        /* =============================================================
           ROOT CONTAINER RESET
           ============================================================= */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] {
            border: none !important;
            background-color: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
        }

        /* =============================================================
           LEVEL 1 CONTAINERS — Profile cards, expander list items
           ============================================================= */
        div.block-container div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container div[data-testid="stExpander"] {
            border: 1px solid var(--border-level-1) !important;
            border-radius: var(--radius-lg) !important;
            background-color: var(--bg-level-1) !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
            padding: var(--space-lg) !important;
            margin-bottom: var(--space-lg) !important;
            transition: border-color 0.2s ease-in-out !important;
        }

        div.block-container div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container div[data-testid="stExpander"]:hover {
            border-color: var(--border-level-2) !important;
        }

        /* Level 1 Expander details & summary */
        div.block-container div[data-testid="stExpander"] > details {
            border: none !important;
            background: transparent !important;
        }

        div.block-container div[data-testid="stExpander"] summary {
            background-color: var(--bg-level-1) !important;
            color: var(--text-color) !important;
            font-family: 'Outfit', sans-serif !important;
            font-weight: 600 !important;
            font-size: 18px !important;
            padding: var(--space-md) var(--space-lg) !important;
            border-radius: var(--radius-lg) !important;
            transition: color 0.2s ease-in-out !important;
        }

        div.block-container div[data-testid="stExpander"] summary p {
            font-size: 18px !important;
            font-weight: 600 !important;
        }

        div.block-container div[data-testid="stExpander"] summary:hover {
            color: var(--whatsapp-green) !important;
        }
        div.block-container div[data-testid="stExpander"] summary:hover svg {
            color: var(--whatsapp-green) !important;
            fill: currentColor !important;
        }

        div.block-container div[data-testid="stExpander"] details[open] summary {
            border-bottom: 1px solid var(--border-level-1) !important;
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
        }

        /* =============================================================
           LEVEL 2 CONTAINERS — Device cards, sub-sections
           ============================================================= */
        /* Device header toggle buttons */
        div[class*="st-key-dev_hdr_btn"] button {
            background-color: var(--bg-level-2) !important;
            color: var(--text-color) !important;
            border: 1px solid var(--border-level-2) !important;
            border-radius: var(--radius-md) !important;
            text-align: left !important;
            justify-content: flex-start !important;
            font-family: 'Outfit', sans-serif !important;
            font-weight: 600 !important;
            font-size: 13px !important;
            padding: var(--space-sm) var(--space-md) !important;
            margin-bottom: -8px !important;
        }

        div[class*="st-key-dev_hdr_btn"] button:hover {
            color: var(--whatsapp-green) !important;
            border-color: var(--whatsapp-green) !important;
            background-color: var(--border-level-1) !important;
        }

        /* Nested containers (Level 2 sub-cards) */
        div.block-container div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] {
            background-color: var(--bg-level-2) !important;
            border: 1px solid var(--border-level-2) !important;
            border-radius: var(--radius-md) !important;
            box-shadow: none !important;
            padding: var(--space-md) !important;
            margin-top: var(--space-sm) !important;
            margin-bottom: var(--space-sm) !important;
        }

        div.block-container div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover {
            border-color: var(--whatsapp-green) !important;
        }

        /* Expanders inside Level 1 (log expanders) */
        div[data-testid="stExpander"] div[data-testid="stExpander"] {
            background-color: var(--bg-level-2) !important;
            border: 1px solid var(--border-level-2) !important;
            border-radius: var(--radius-md) !important;
        }

        div[data-testid="stExpander"] div[data-testid="stExpander"] summary {
            background-color: var(--bg-level-2) !important;
            border-radius: var(--radius-md) !important;
            padding: var(--space-sm) var(--space-md) !important;
            font-size: 13px !important;
        }

        /* =============================================================
           LEVEL 3 CONTAINERS — Code/log panels, inner blocks
           ============================================================= */
        div.block-container div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] {
            background-color: var(--bg-level-3) !important;
            border: 1px solid var(--border-level-3) !important;
            box-shadow: none !important;
            padding: var(--space-md) !important;
            border-radius: var(--radius-md) !important;
        }

        div.block-container div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover {
            border-color: var(--whatsapp-green) !important;
        }

        /* =============================================================
           BUTTONS — Compact density
           ============================================================= */
        button {
            border-radius: var(--radius-sm) !important;
            font-weight: 500 !important;
            font-size: 13px !important;
            padding: 6px 12px !important;
            transition: all 0.2s ease-in-out !important;
        }

        button[kind="primary"] {
            background-color: var(--whatsapp-green) !important;
            color: #121212 !important;
            border: 1px solid var(--whatsapp-green) !important;
            font-weight: 600 !important;
        }

        button[kind="primary"]:hover {
            background-color: var(--whatsapp-green-hover) !important;
            color: #121212 !important;
            box-shadow: 0 2px 8px rgba(37, 211, 102, 0.25) !important;
            transform: translateY(-1px);
        }

        button[kind="secondary"] {
            background-color: #2D2D2D !important;
            color: var(--text-secondary) !important;
            border: 1px solid var(--border-level-2) !important;
        }

        button[kind="secondary"]:hover {
            border-color: var(--whatsapp-green) !important;
            color: var(--whatsapp-green) !important;
            background-color: #333333 !important;
            box-shadow: 0 2px 6px rgba(37, 211, 102, 0.08) !important;
        }

        /* =============================================================
           INPUTS & FORM FIELDS
           ============================================================= */
        div[data-baseweb="input"], div[data-baseweb="textarea"], div[data-baseweb="select"] {
            background-color: var(--bg-level-2) !important;
            border: 1px solid var(--border-level-1) !important;
            border-radius: var(--radius-sm) !important;
            color: var(--text-color) !important;
        }

        /* Inputs inside Level 2 */
        div.block-container div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="input"],
        div.block-container div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="input"],
        div.block-container div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="textarea"],
        div.block-container div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="textarea"],
        div.block-container div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="select"],
        div.block-container div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="select"] {
            background-color: var(--bg-level-3) !important;
            border-color: var(--border-level-2) !important;
        }

        input, textarea, select {
            color: var(--text-color) !important;
            background-color: transparent !important;
            font-size: 13px !important;
        }

        div[data-baseweb="input"]:focus-within, div[data-baseweb="textarea"]:focus-within, div[data-baseweb="select"]:focus-within {
            border-color: var(--whatsapp-green) !important;
            box-shadow: 0 0 0 1px var(--whatsapp-green) !important;
        }

        /* Multi-select tag bubbles */
        span[role="button"] {
            background-color: #2D2D2D !important;
            border: 1px solid var(--border-level-2) !important;
            color: var(--text-color) !important;
            font-size: 12px !important;
        }

        /* Label styling */
        div[data-testid="stWidgetLabel"] label,
        div[data-testid="stWidgetLabel"] p {
            font-size: 13px !important;
            color: var(--text-secondary) !important;
            margin-bottom: var(--space-xs) !important;
        }

        /* =============================================================
           ALERTS — Compact
           ============================================================= */
        div[data-testid="stAlert"] {
            background-color: var(--bg-level-1) !important;
            border: 1px solid var(--border-level-1) !important;
            border-radius: var(--radius-md) !important;
            padding: var(--space-sm) var(--space-md) !important;
        }

        div[data-testid="stAlert"] div {
            font-size: 16px !important;
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

        /* =============================================================
           CODE & PRE — Compact
           ============================================================= */
        code {
            color: var(--whatsapp-green) !important;
            background-color: var(--bg-level-3) !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 12.5px !important;
            padding: 1px 5px !important;
            border-radius: 3px !important;
        }

        pre {
            background-color: var(--bg-level-3) !important;
            border: 1px solid var(--border-level-2) !important;
            border-radius: var(--radius-md) !important;
            padding: var(--space-md) !important;
            box-shadow: inset 0 1px 4px rgba(0,0,0,0.3) !important;
        }

        pre code {
            padding: 0 !important;
            background-color: transparent !important;
        }

        /* =============================================================
           TOAST
           ============================================================= */
        div[data-testid="stToast"] {
            background-color: var(--bg-level-2) !important;
            color: var(--text-color) !important;
            border-left: 4px solid var(--whatsapp-green) !important;
            font-size: 13px !important;
        }

        /* =============================================================
           PROGRESS BAR
           ============================================================= */
        div[role="progressbar"] > div {
            background-color: var(--whatsapp-green) !important;
        }

        /* =============================================================
           SCROLLBARS
           ============================================================= */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: var(--bg-page);
        }
        ::-webkit-scrollbar-thumb {
            background: #3E3E3E;
            border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: var(--whatsapp-green);
        }

        /* =============================================================
           LOG VIEWER TOGGLE
           ============================================================= */
        div[class*="st-key-toggle_logs"] {
            border: 1px solid var(--border-level-3) !important;
            border-radius: var(--radius-sm) !important;
            padding: 6px var(--space-md) !important;
            background-color: var(--bg-level-3) !important;
            margin-top: var(--space-sm) !important;
            margin-bottom: var(--space-sm) !important;
            transition: all 0.2s ease-in-out !important;
        }

        div[class*="st-key-toggle_logs"]:hover {
            border-color: var(--whatsapp-green) !important;
            background-color: var(--whatsapp-green-alpha) !important;
            box-shadow: 0 1px 4px rgba(37, 211, 102, 0.05) !important;
        }

        /* =============================================================
           COLUMN BORDER/HOVER RESETS
           ============================================================= */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="column"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="column"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stHorizontalBlock"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stHorizontalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] {
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="column"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="column"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stHorizontalBlock"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stHorizontalBlock"] div[data-testid="stVerticalBlockBorderWrapper"]:hover {
            border: none !important;
            border-color: transparent !important;
            box-shadow: none !important;
            background-color: transparent !important;
        }
    </style>
    """, unsafe_allow_html=True)

    # Inject client-side JS to automatically repair malformed localStorage UUID entries
    # that cause Streamlit's MetricsManager.getAnonymousId to throw JSON.parse exceptions.
    st.markdown("""
    <script>
    (function() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                const val = localStorage.getItem(key);
                if (val && !val.startsWith('{') && !val.startsWith('[') && !val.startsWith('"')) {
                    // Check if it looks like a raw string or UUID and is a streamlit/metrics/user key
                    if (key.includes('streamlit') || key.includes('metrics') || key.includes('ajs') || key.includes('user') || key.includes('id')) {
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (e) {
            console.error("Local storage cleanup failed: ", e);
        }
    })();
    </script>
    """, unsafe_allow_html=True)
