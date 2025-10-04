#!/usr/bin/env python3
"""
Census Data Downloader
Downloads TIGER/Line shapefiles for all US geographic levels
"""

import requests
import zipfile
import geopandas as gpd
import pandas as pd
from pathlib import Path
import logging
from urllib.parse import urljoin
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import os

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CensusDataDownloader:
    """Download and process Census TIGER/Line data"""
    
    def __init__(self, output_dir="census_data", year=2024):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.year = year
        self.base_url = f"https://www2.census.gov/geo/tiger/TIGER{year}/"
        
        # State FIPS codes for all 50 states + DC + territories
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
            '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming',
            # Territories
            '60': 'American Samoa', '66': 'Guam', '69': 'Northern Mariana Islands',
            '72': 'Puerto Rico', '78': 'Virgin Islands'
        }
    
    def download_file(self, url: str, output_path: Path, desc: str = "") -> bool:
        """Download a single file with progress tracking"""
        try:
            logger.info(f"Downloading {desc}: {url}")
            
            response = requests.get(url, stream=True)
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
    
    def extract_and_convert_to_geojson(self, zip_path: Path, output_name: str) -> bool:
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
    
    def download_census_tracts(self) -> bool:
        """Download census tracts for all states"""
        logger.info("Starting Census Tracts download...")
        
        all_tracts = []
        successful_downloads = 0
        
        for fips, state_name in self.state_fips.items():
            if fips in ['60', '66', '69', '78']:  # Skip territories for now
                continue
                
            url = f"{self.base_url}TRACT/tl_{self.year}_{fips}_tract.zip"
            zip_path = self.output_dir / f"tract_{fips}.zip"
            
            if self.download_file(url, zip_path, f"Tracts for {state_name}"):
                # Extract and read
                try:
                    extract_dir = zip_path.parent / f"temp_tract_{fips}"
                    extract_dir.mkdir(exist_ok=True)
                    
                    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                        zip_ref.extractall(extract_dir)
                    
                    shp_file = list(extract_dir.glob("*.shp"))[0]
                    gdf = gpd.read_file(shp_file)
                    all_tracts.append(gdf)
                    successful_downloads += 1
                    
                    # Cleanup
                    import shutil
                    shutil.rmtree(extract_dir)
                    zip_path.unlink()
                    
                except Exception as e:
                    logger.error(f"Failed to process tracts for {state_name}: {e}")
        
        if all_tracts:
            # Combine all tracts
            logger.info("Combining all census tracts...")
            combined_tracts = gpd.GeoDataFrame(pd.concat(all_tracts, ignore_index=True))
            
            output_file = self.output_dir / "us_census_tracts.json"
            combined_tracts.to_file(output_file, driver='GeoJSON')
            
            logger.info(f"Created {output_file} with {len(combined_tracts)} census tracts")
            logger.info(f"Successfully downloaded tracts for {successful_downloads} states")
            
            return True
        
        return False
    
    def download_block_groups(self) -> bool:
        """Download block groups for all states"""
        logger.info("Starting Block Groups download...")
        
        all_bg = []
        successful_downloads = 0
        
        for fips, state_name in self.state_fips.items():
            if fips in ['60', '66', '69', '78']:  # Skip territories
                continue
                
            url = f"{self.base_url}BG/tl_{self.year}_{fips}_bg.zip"
            zip_path = self.output_dir / f"bg_{fips}.zip"
            
            if self.download_file(url, zip_path, f"Block Groups for {state_name}"):
                try:
                    extract_dir = zip_path.parent / f"temp_bg_{fips}"
                    extract_dir.mkdir(exist_ok=True)
                    
                    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                        zip_ref.extractall(extract_dir)
                    
                    shp_file = list(extract_dir.glob("*.shp"))[0]
                    gdf = gpd.read_file(shp_file)
                    all_bg.append(gdf)
                    successful_downloads += 1
                    
                    # Cleanup
                    import shutil
                    shutil.rmtree(extract_dir)
                    zip_path.unlink()
                    
                except Exception as e:
                    logger.error(f"Failed to process block groups for {state_name}: {e}")
        
        if all_bg:
            logger.info("Combining all block groups...")
            combined_bg = gpd.GeoDataFrame(pd.concat(all_bg, ignore_index=True))
            
            output_file = self.output_dir / "us_block_groups.json"
            combined_bg.to_file(output_file, driver='GeoJSON')
            
            logger.info(f"Created {output_file} with {len(combined_bg)} block groups")
            logger.info(f"Successfully downloaded block groups for {successful_downloads} states")
            
            return True
        
        return False
    
    def download_places(self) -> bool:
        """Download places (cities/towns) for all states"""
        logger.info("Starting Places download...")
        
        all_places = []
        successful_downloads = 0
        
        for fips, state_name in self.state_fips.items():
            if fips in ['60', '66', '69', '78']:  # Skip territories
                continue
                
            url = f"{self.base_url}PLACE/tl_{self.year}_{fips}_place.zip"
            zip_path = self.output_dir / f"place_{fips}.zip"
            
            if self.download_file(url, zip_path, f"Places for {state_name}"):
                try:
                    extract_dir = zip_path.parent / f"temp_place_{fips}"
                    extract_dir.mkdir(exist_ok=True)
                    
                    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                        zip_ref.extractall(extract_dir)
                    
                    shp_file = list(extract_dir.glob("*.shp"))[0]
                    gdf = gpd.read_file(shp_file)
                    all_places.append(gdf)
                    successful_downloads += 1
                    
                    # Cleanup
                    import shutil
                    shutil.rmtree(extract_dir)
                    zip_path.unlink()
                    
                except Exception as e:
                    logger.error(f"Failed to process places for {state_name}: {e}")
        
        if all_places:
            logger.info("Combining all places...")
            combined_places = gpd.GeoDataFrame(pd.concat(all_places, ignore_index=True))
            
            output_file = self.output_dir / "us_places.json"
            combined_places.to_file(output_file, driver='GeoJSON')
            
            logger.info(f"Created {output_file} with {len(combined_places)} places")
            logger.info(f"Successfully downloaded places for {successful_downloads} states")
            
            return True
        
        return False
    
    def download_congressional_districts(self) -> bool:
        """Download Congressional Districts"""
        logger.info("Starting Congressional Districts download...")
        
        url = f"{self.base_url}CD/tl_{self.year}_us_cd118.zip"
        zip_path = self.output_dir / "congressional_districts.zip"
        
        if self.download_file(url, zip_path, "Congressional Districts"):
            return self.extract_and_convert_to_geojson(zip_path, "us_congressional_districts")
        
        return False
    
    def run_recommended_download(self):
        """Download the recommended starter set"""
        logger.info("="*60)
        logger.info("STARTING RECOMMENDED CENSUS DATA DOWNLOAD")
        logger.info("="*60)
        
        start_time = time.time()
        
        downloads = [
            ("Census Tracts", self.download_census_tracts),
            ("Block Groups", self.download_block_groups), 
            ("Places", self.download_places),
            ("Congressional Districts", self.download_congressional_districts)
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
        logger.info("\n" + "="*60)
        logger.info("DOWNLOAD SUMMARY")
        logger.info("="*60)
        
        for name, success in results.items():
            status = "✅" if success else "❌"
            logger.info(f"{status} {name}")
        
        successful = sum(results.values())
        logger.info(f"\nCompleted: {successful}/{len(results)} downloads")
        logger.info(f"Total time: {elapsed/60:.1f} minutes")
        
        # Check output files
        output_files = list(self.output_dir.glob("*.json"))
        if output_files:
            logger.info(f"\nOutput files created:")
            total_size = 0
            for file_path in output_files:
                size_mb = file_path.stat().st_size / (1024*1024)
                total_size += size_mb
                logger.info(f"  {file_path.name}: {size_mb:.1f} MB")
            
            logger.info(f"Total size: {total_size:.1f} MB")

def main():
    """Main function with command line options"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Download Census TIGER/Line data')
    parser.add_argument('--output-dir', default='data', help='Output directory')
    parser.add_argument('--year', type=int, default=2024, help='Census year')
    parser.add_argument('--tracts-only', action='store_true', help='Download only census tracts')
    parser.add_argument('--recommended', action='store_true', help='Download recommended starter set')
    
    args = parser.parse_args()
    
    downloader = CensusDataDownloader(args.output_dir, args.year)
    
    if args.tracts_only:
        downloader.download_census_tracts()
    elif args.recommended:
        downloader.run_recommended_download()
    else:
        print("Choose an option:")
        print("  --recommended   Download recommended starter set (~400 MB)")
        print("  --tracts-only   Download only census tracts (~150 MB)")

if __name__ == "__main__":
    main()