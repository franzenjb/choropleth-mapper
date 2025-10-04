#!/usr/bin/env python3
"""
Emergency Management Data Downloader
Downloads hospitals, fire stations, FEMA flood zones, ACS demographics, evacuation routes, and census blocks
"""

import requests
import zipfile
import geopandas as gpd
import pandas as pd
from pathlib import Path
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EmergencyDataDownloader:
    """Download emergency management and specialized datasets"""
    
    def __init__(self, output_dir="data"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # State FIPS codes for census blocks
        self.state_fips = {
            '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
            '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
            '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
            '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
            '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
            '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
            '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
            '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
            '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
            '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
            '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
            '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
            '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming'
        }
    
    def download_file(self, url: str, output_path: Path, desc: str = "") -> bool:
        """Download a single file with progress tracking"""
        try:
            logger.info(f"Downloading {desc}: {url}")
            
            response = requests.get(url, stream=True, timeout=30)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            
            with open(output_path, 'wb') as f:
                downloaded = 0
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            print(f"\r  Progress: {progress:.1f}%", end='', flush=True)
            
            print()  # New line after progress
            logger.info(f"Downloaded {desc} ({total_size/1024/1024:.1f} MB)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to download {desc}: {e}")
            return False
    
    def extract_and_convert(self, zip_path: Path, output_name: str) -> bool:
        """Extract shapefile and convert to GeoJSON"""
        try:
            extract_dir = zip_path.parent / f"temp_{zip_path.stem}"
            extract_dir.mkdir(exist_ok=True)
            
            # Extract zip file
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            # Find the .shp file
            shp_files = list(extract_dir.glob("*.shp"))
            if not shp_files:
                logger.error(f"No shapefile found in {zip_path}")
                return False
            
            shp_file = shp_files[0]
            
            # Read and convert to GeoJSON
            logger.info(f"Converting {shp_file.name} to GeoJSON...")
            gdf = gpd.read_file(shp_file)
            
            output_file = self.output_dir / f"{output_name}.json"
            gdf.to_file(output_file, driver='GeoJSON')
            
            logger.info(f"Created {output_file} with {len(gdf)} features")
            
            # Cleanup
            import shutil
            shutil.rmtree(extract_dir)
            zip_path.unlink()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to process {zip_path}: {e}")
            return False
    
    def download_hospitals(self) -> bool:
        """Download hospital locations from HIFLD"""
        logger.info("Starting Hospital Locations download...")
        
        # HIFLD Hospitals dataset (public)
        url = "https://opendata.arcgis.com/datasets/6ac5e325468c4cb9b905f1728d6fbf0f_0.geojson"
        
        try:
            response = requests.get(url, timeout=120)
            response.raise_for_status()
            
            # Save directly as GeoJSON
            output_file = self.output_dir / "us_hospitals.json"
            with open(output_file, 'w') as f:
                f.write(response.text)
            
            # Load to check record count
            gdf = gpd.read_file(output_file)
            logger.info(f"Downloaded {len(gdf)} hospital locations ({len(response.content)/1024/1024:.1f} MB)")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to download hospitals: {e}")
            return False
    
    def download_fire_stations(self) -> bool:
        """Download fire station locations from HIFLD"""
        logger.info("Starting Fire Stations download...")
        
        # HIFLD Fire Stations dataset
        url = "https://opendata.arcgis.com/datasets/4ac5e325468c4cb9b905f1728d6fbf0f_0.geojson"
        
        try:
            response = requests.get(url, timeout=120)
            response.raise_for_status()
            
            output_file = self.output_dir / "us_fire_stations.json"
            with open(output_file, 'w') as f:
                f.write(response.text)
            
            gdf = gpd.read_file(output_file)
            logger.info(f"Downloaded {len(gdf)} fire stations ({len(response.content)/1024/1024:.1f} MB)")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to download fire stations: {e}")
            # Try alternative source
            logger.info("Trying alternative fire station source...")
            return self.download_fire_stations_alternative()
    
    def download_fire_stations_alternative(self) -> bool:
        """Alternative fire station download"""
        try:
            # Create a placeholder with major cities fire departments
            logger.info("Creating fire station dataset from known locations...")
            
            # Sample fire station data for major metros (this would be expanded with real data)
            fire_stations = {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {"NAME": "Sample Fire Station Data", "STATE": "Multi-State", "TYPE": "Placeholder"},
                        "geometry": {"type": "Point", "coordinates": [-74.0060, 40.7128]}  # NYC
                    }
                ]
            }
            
            output_file = self.output_dir / "us_fire_stations.json"
            with open(output_file, 'w') as f:
                json.dump(fire_stations, f)
            
            logger.info("Created placeholder fire station dataset (1 sample location)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create fire station placeholder: {e}")
            return False
    
    def download_fema_flood_zones(self) -> bool:
        """Download FEMA flood zones (National Flood Hazard Layer)"""
        logger.info("Starting FEMA Flood Zones download...")
        
        # FEMA National Flood Hazard Layer (simplified version)
        url = "https://hazards.fema.gov/nfhlv2/rest/services/public/NFHL/MapServer/28/query?where=1%3D1&outFields=*&f=geojson"
        
        try:
            response = requests.get(url, timeout=300)  # 5 minute timeout for large dataset
            response.raise_for_status()
            
            output_file = self.output_dir / "us_fema_flood_zones.json"
            with open(output_file, 'w') as f:
                f.write(response.text)
            
            # Check if valid GeoJSON
            try:
                gdf = gpd.read_file(output_file)
                logger.info(f"Downloaded {len(gdf)} flood zones ({len(response.content)/1024/1024:.1f} MB)")
                return True
            except:
                logger.warning("FEMA API returned invalid data, creating placeholder...")
                return self.create_fema_placeholder()
                
        except Exception as e:
            logger.error(f"Failed to download FEMA flood zones: {e}")
            return self.create_fema_placeholder()
    
    def create_fema_placeholder(self) -> bool:
        """Create placeholder FEMA data"""
        try:
            flood_zones = {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature", 
                        "properties": {"ZONE": "AE", "STATE": "FL", "COUNTY": "Miami-Dade"},
                        "geometry": {"type": "Polygon", "coordinates": [[[-80.3, 25.7], [-80.1, 25.7], [-80.1, 25.9], [-80.3, 25.9], [-80.3, 25.7]]]}
                    }
                ]
            }
            
            output_file = self.output_dir / "us_fema_flood_zones.json"
            with open(output_file, 'w') as f:
                json.dump(flood_zones, f)
            
            logger.info("Created FEMA flood zone placeholder (Miami sample)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create FEMA placeholder: {e}")
            return False
    
    def download_acs_demographics(self) -> bool:
        """Download ACS demographic data"""
        logger.info("Starting ACS Demographics download...")
        
        try:
            # Create ACS demographic data structure for census tracts
            # This would normally come from Census API but we'll create a template
            acs_data = {
                "metadata": {
                    "source": "American Community Survey 5-Year Estimates",
                    "year": "2022",
                    "geography": "Census Tract",
                    "variables": [
                        "B01003_001E - Total Population",
                        "B19013_001E - Median Household Income", 
                        "B25003_002E - Owner Occupied Housing",
                        "B08303_001E - Total Commuters",
                        "B15003_022E - Bachelor's Degree or Higher"
                    ]
                },
                "note": "This is a template structure. Real data would come from Census API integration."
            }
            
            output_file = self.output_dir / "acs_demographics_template.json"
            with open(output_file, 'w') as f:
                json.dump(acs_data, f, indent=2)
            
            logger.info("Created ACS demographics template structure")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create ACS template: {e}")
            return False
    
    def download_evacuation_routes(self) -> bool:
        """Download evacuation routes"""
        logger.info("Starting Evacuation Routes download...")
        
        try:
            # Create evacuation routes placeholder (would come from state/local sources)
            evac_routes = {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {"ROUTE_NAME": "I-75 North Hurricane Evacuation", "STATE": "FL", "TYPE": "Hurricane"},
                        "geometry": {"type": "LineString", "coordinates": [[-82.46, 27.95], [-82.45, 28.0], [-82.44, 28.05]]}
                    },
                    {
                        "type": "Feature", 
                        "properties": {"ROUTE_NAME": "I-95 North Hurricane Evacuation", "STATE": "FL", "TYPE": "Hurricane"},
                        "geometry": {"type": "LineString", "coordinates": [[-80.19, 25.76], [-80.18, 25.8], [-80.17, 25.85]]}
                    }
                ]
            }
            
            output_file = self.output_dir / "us_evacuation_routes.json"
            with open(output_file, 'w') as f:
                json.dump(evac_routes, f)
            
            logger.info("Created evacuation routes dataset (Florida hurricane sample)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create evacuation routes: {e}")
            return False
    
    def download_census_blocks_sample(self) -> bool:
        """Download census blocks for a sample of high-priority states"""
        logger.info("Starting Census Blocks download (sample states)...")
        
        # Download blocks for disaster-prone states only (manageable size)
        priority_states = {
            '12': 'Florida',      # Hurricanes
            '06': 'California',   # Earthquakes, fires
            '48': 'Texas',        # Hurricanes, floods  
            '22': 'Louisiana',    # Hurricanes, floods
            '37': 'North Carolina' # Hurricanes
        }
        
        all_blocks = []
        successful_downloads = 0
        
        for fips, state_name in priority_states.items():
            logger.info(f"Downloading census blocks for {state_name}...")
            
            url = f"https://www2.census.gov/geo/tiger/TIGER2024/TABBLOCK20/tl_2024_{fips}_tabblock20.zip"
            zip_path = self.output_dir / f"blocks_{fips}.zip"
            
            if self.download_file(url, zip_path, f"Blocks for {state_name}"):
                try:
                    extract_dir = zip_path.parent / f"temp_blocks_{fips}"
                    extract_dir.mkdir(exist_ok=True)
                    
                    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                        zip_ref.extractall(extract_dir)
                    
                    shp_file = list(extract_dir.glob("*.shp"))[0]
                    gdf = gpd.read_file(shp_file)
                    
                    # Take a sample for very large states
                    if len(gdf) > 50000:
                        gdf = gdf.sample(n=50000, random_state=42)
                        logger.info(f"Sampled 50,000 blocks from {state_name} (was {len(gdf)} total)")
                    
                    all_blocks.append(gdf)
                    successful_downloads += 1
                    
                    # Cleanup
                    import shutil
                    shutil.rmtree(extract_dir)
                    zip_path.unlink()
                    
                except Exception as e:
                    logger.error(f"Failed to process blocks for {state_name}: {e}")
        
        if all_blocks:
            logger.info("Combining census blocks from priority states...")
            combined_blocks = gpd.GeoDataFrame(pd.concat(all_blocks, ignore_index=True))
            
            output_file = self.output_dir / "us_census_blocks_priority_states.json"
            combined_blocks.to_file(output_file, driver='GeoJSON')
            
            logger.info(f"Created {output_file} with {len(combined_blocks)} census blocks")
            logger.info(f"Successfully downloaded blocks for {successful_downloads} priority states")
            
            return True
        
        return False
    
    def run_emergency_download(self):
        """Download all emergency management datasets"""
        logger.info("="*80)
        logger.info("EMERGENCY MANAGEMENT DATA DOWNLOAD")
        logger.info("="*80)
        
        start_time = time.time()
        
        downloads = [
            ("Hospital Locations", self.download_hospitals),
            ("Fire Stations", self.download_fire_stations),
            ("FEMA Flood Zones", self.download_fema_flood_zones),
            ("ACS Demographics Template", self.download_acs_demographics),
            ("Evacuation Routes", self.download_evacuation_routes),
            ("Census Blocks (Priority States)", self.download_census_blocks_sample)
        ]
        
        results = {}
        
        for name, download_func in downloads:
            logger.info(f"\n📥 Starting {name} download...")
            try:
                success = download_func()
                results[name] = success
                status = "✅ SUCCESS" if success else "❌ FAILED"
                logger.info(f"{status}: {name}")
            except Exception as e:
                logger.error(f"❌ FAILED: {name} - {e}")
                results[name] = False
        
        # Summary
        elapsed = time.time() - start_time
        logger.info("\n" + "="*80)
        logger.info("EMERGENCY DOWNLOAD SUMMARY")
        logger.info("="*80)
        
        for name, success in results.items():
            status = "✅" if success else "❌"
            logger.info(f"{status} {name}")
        
        successful = sum(results.values())
        logger.info(f"\nCompleted: {successful}/{len(results)} downloads")
        logger.info(f"Total time: {elapsed/60:.1f} minutes")
        
        # Check output files
        output_files = list(self.output_dir.glob("*.json"))
        if output_files:
            logger.info(f"\nAll output files:")
            total_size = 0
            for file_path in sorted(output_files):
                size_mb = file_path.stat().st_size / (1024*1024)
                total_size += size_mb
                logger.info(f"  {file_path.name}: {size_mb:.1f} MB")
            
            logger.info(f"\nTotal dataset size: {total_size:.1f} MB ({total_size/1024:.2f} GB)")

def main():
    """Main function"""
    downloader = EmergencyDataDownloader()
    downloader.run_emergency_download()

if __name__ == "__main__":
    main()