#!/usr/bin/env python3
"""
Quick High-Value Additions
Download the most valuable missing layers for Red Cross use
"""

import requests
import zipfile
import geopandas as gpd
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_congressional_districts():
    """Download Congressional Districts - we missed this in the main download"""
    logger.info("Downloading Congressional Districts...")
    
    url = "https://www2.census.gov/geo/tiger/TIGER2024/CD/tl_2024_us_cd118.zip"
    zip_path = Path("congressional_districts.zip")
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        with open(zip_path, 'wb') as f:
            f.write(response.content)
        
        logger.info(f"Downloaded {len(response.content)/1024/1024:.1f} MB")
        
        # Extract and convert
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall("temp_cd")
        
        shp_file = Path("temp_cd").glob("*.shp").__next__()
        gdf = gpd.read_file(shp_file)
        
        output_file = Path("data/us_congressional_districts.json")
        gdf.to_file(output_file, driver='GeoJSON')
        
        logger.info(f"Created {output_file} with {len(gdf)} congressional districts")
        
        # Cleanup
        zip_path.unlink()
        import shutil
        shutil.rmtree("temp_cd")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to download congressional districts: {e}")
        return False

def download_major_roads():
    """Download primary roads (interstate highways)"""
    logger.info("Downloading Major Roads (Primary/Interstate)...")
    
    url = "https://www2.census.gov/geo/tiger/TIGER2024/PRIMARYROADS/tl_2024_us_primaryroads.zip"
    zip_path = Path("primary_roads.zip")
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        with open(zip_path, 'wb') as f:
            f.write(response.content)
        
        logger.info(f"Downloaded {len(response.content)/1024/1024:.1f} MB")
        
        # Extract and convert
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall("temp_roads")
        
        shp_file = Path("temp_roads").glob("*.shp").__next__()
        gdf = gpd.read_file(shp_file)
        
        output_file = Path("data/us_major_roads.json")
        gdf.to_file(output_file, driver='GeoJSON')
        
        logger.info(f"Created {output_file} with {len(gdf)} road segments")
        
        # Cleanup
        zip_path.unlink()
        import shutil
        shutil.rmtree("temp_roads")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to download roads: {e}")
        return False

def main():
    """Download the most valuable missing layers"""
    print("="*60)
    print("QUICK HIGH-VALUE ADDITIONS")
    print("="*60)
    
    downloads = [
        ("Congressional Districts", download_congressional_districts),
        ("Major Roads/Highways", download_major_roads)
    ]
    
    results = {}
    
    for name, download_func in downloads:
        print(f"\n📥 Downloading {name}...")
        try:
            success = download_func()
            results[name] = success
            status = "✅ SUCCESS" if success else "❌ FAILED"
            print(f"{status}: {name}")
        except Exception as e:
            print(f"❌ FAILED: {name} - {e}")
            results[name] = False
    
    print(f"\n{'='*60}")
    print("DOWNLOAD SUMMARY")
    print("="*60)
    
    for name, success in results.items():
        status = "✅" if success else "❌"
        print(f"{status} {name}")
    
    successful = sum(results.values())
    print(f"\nCompleted: {successful}/{len(results)} downloads")

if __name__ == "__main__":
    main()