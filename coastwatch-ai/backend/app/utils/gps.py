"""
GPS Extraction and Geolocation Utilities
Extracts GPS coordinates from image EXIF data and matches to nearest colony sites.
"""
from typing import Optional, Tuple
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import math


def extract_gps_from_image(image_path: str) -> Optional[Tuple[float, float]]:
    """
    Extract GPS coordinates (latitude, longitude) from image EXIF data.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Tuple of (latitude, longitude) or None if no GPS data found
    """
    try:
        image = Image.open(image_path)
        exif_data = image._getexif()
        
        if not exif_data:
            return None
        
        # Find GPS Info tag
        gps_info = None
        for tag_id, value in exif_data.items():
            tag_name = TAGS.get(tag_id, tag_id)
            if tag_name == 'GPSInfo':
                gps_info = value
                break
        
        if not gps_info:
            return None
        
        # Parse GPS data
        gps_data = {}
        for key in gps_info.keys():
            decode = GPSTAGS.get(key, key)
            gps_data[decode] = gps_info[key]
        
        # Extract latitude
        if 'GPSLatitude' in gps_data and 'GPSLatitudeRef' in gps_data:
            lat = _convert_to_degrees(gps_data['GPSLatitude'])
            if gps_data['GPSLatitudeRef'] == 'S':
                lat = -lat
        else:
            return None
        
        # Extract longitude
        if 'GPSLongitude' in gps_data and 'GPSLongitudeRef' in gps_data:
            lon = _convert_to_degrees(gps_data['GPSLongitude'])
            if gps_data['GPSLongitudeRef'] == 'W':
                lon = -lon
        else:
            return None
        
        return (lat, lon)
    
    except Exception as e:
        print(f"Error extracting GPS from image: {e}")
        return None


def _convert_to_degrees(value) -> float:
    """
    Convert GPS coordinates stored in EXIF to decimal degrees.
    GPS coords are stored as (degrees, minutes, seconds) tuples.
    """
    try:
        d = float(value[0])
        m = float(value[1])
        s = float(value[2])
        return d + (m / 60.0) + (s / 3600.0)
    except (TypeError, IndexError):
        # Handle case where value is already a float or malformed
        return float(value[0]) if isinstance(value, (list, tuple)) else float(value)


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two GPS coordinates using Haversine formula.
    
    Args:
        lat1, lon1: First coordinate
        lat2, lon2: Second coordinate
        
    Returns:
        Distance in kilometers
    """
    # Earth radius in kilometers
    R = 6371.0
    
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Haversine formula
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance


def find_nearest_colony_site(lat: float, lon: float, colony_sites: list[dict]) -> dict:
    """
    Find the nearest Louisiana colony site to given GPS coordinates.
    
    Args:
        lat: Latitude of detection location
        lon: Longitude of detection location
        colony_sites: List of colony site dictionaries with 'lat', 'lng', 'name', 'habitat' keys
        
    Returns:
        Nearest colony site dictionary
    """
    nearest_site = None
    min_distance = float('inf')
    
    for site in colony_sites:
        distance = calculate_distance(lat, lon, site['lat'], site['lng'])
        if distance < min_distance:
            min_distance = distance
            nearest_site = site
    
    # Add distance to the result for transparency
    if nearest_site:
        nearest_site = nearest_site.copy()
        nearest_site['distance_km'] = round(min_distance, 2)
    
    return nearest_site
