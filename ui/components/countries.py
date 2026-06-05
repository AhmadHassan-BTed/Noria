import phonenumbers
import pycountry

def _load_countries():
    """Dynamically builds and sorts the list of countries using python libraries."""
    countries_list = []
    # Loop over all dialing codes and region codes mapped by Google's phonenumbers library
    for code, regions in phonenumbers.COUNTRY_CODE_TO_REGION_CODE.items():
        dial_code = f"+{code}"
        for region in regions:
            country_obj = pycountry.countries.get(alpha_2=region)
            if country_obj:
                country_name = country_obj.name
                countries_list.append((country_name, region, dial_code))
                
    # Sort alphabetically by country name
    countries_list.sort(key=lambda x: x[0])
    return countries_list

# Load the database dynamically at startup
COUNTRIES = _load_countries()
