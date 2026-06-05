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

        div[data-testid="stDecoration"] {
            background-image: linear-gradient(90deg, var(--whatsapp-green), var(--whatsapp-green-hover)) !important;
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
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"],
        div.block-container > div[data-testid="stVerticalBlock"] > div > div > div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlock"] > div > div > div[data-testid="stExpander"] {
            border: 1px solid var(--border-level-1) !important;
            border-radius: var(--radius-lg) !important;
            background-color: var(--bg-level-1) !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
            padding: var(--space-lg) !important;
            margin-bottom: var(--space-lg) !important;
            transition: border-color 0.2s ease-in-out !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"]:hover,
        div.block-container > div[data-testid="stVerticalBlock"] > div > div > div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlock"] > div > div > div[data-testid="stExpander"]:hover {
            border-color: var(--border-level-2) !important;
        }

        /* Level 1 Expander details & summary */
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] > details,
        div.block-container > div[data-testid="stVerticalBlock"] > div > div > div[data-testid="stExpander"] > details {
            border: none !important;
            background: transparent !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] summary,
        div.block-container > div[data-testid="stVerticalBlock"] > div > div > div[data-testid="stExpander"] summary {
            background-color: var(--bg-level-1) !important;
            color: var(--text-color) !important;
            font-family: 'Outfit', sans-serif !important;
            font-weight: 600 !important;
            font-size: 18px !important;
            padding: var(--space-md) var(--space-lg) !important;
            border-radius: var(--radius-lg) !important;
            transition: color 0.2s ease-in-out !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] summary p,
        div.block-container > div[data-testid="stVerticalBlock"] > div > div > div[data-testid="stExpander"] summary p {
            font-size: 18px !important;
            font-weight: 600 !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] summary:hover,
        div.block-container > div[data-testid="stVerticalBlock"] > div > div > div[data-testid="stExpander"] summary:hover {
            color: var(--whatsapp-green) !important;
        }
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] summary:hover svg,
        div.block-container > div[data-testid="stVerticalBlock"] > div > div > div[data-testid="stExpander"] summary:hover svg {
            color: var(--whatsapp-green) !important;
            fill: currentColor !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] > div > div > div[data-testid="stExpander"] details[open] summary,
        div.block-container > div[data-testid="stVerticalBlock"] > div > div > div[data-testid="stExpander"] details[open] summary {
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
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] {
            background-color: var(--bg-level-2) !important;
            border: 1px solid var(--border-level-2) !important;
            border-radius: var(--radius-md) !important;
            box-shadow: none !important;
            padding: var(--space-md) !important;
            margin-top: var(--space-sm) !important;
            margin-bottom: var(--space-sm) !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover {
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
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"],
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] {
            background-color: var(--bg-level-3) !important;
            border: 1px solid var(--border-level-3) !important;
            box-shadow: none !important;
            padding: var(--space-md) !important;
            border-radius: var(--radius-md) !important;
        }

        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stExpander"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover,
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"]:hover {
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
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="input"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="input"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="textarea"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="textarea"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="select"],
        div.block-container > div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="select"],
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="input"],
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="input"],
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="textarea"],
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="textarea"],
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-baseweb="select"],
        div.block-container > div[data-testid="stVerticalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stExpander"] div[data-baseweb="select"] {
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
