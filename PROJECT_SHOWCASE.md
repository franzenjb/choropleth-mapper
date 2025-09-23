# Choropleth Mapper - Project Showcase

## Project Overview
**Name:** Choropleth Mapper  
**Type:** Geographic Data Visualization Tool  
**Status:** Production Ready  
**URL:** https://franzenjb.github.io/choropleth-mapper/  
**Repository:** https://github.com/franzenjb/choropleth-mapper  

## Technical Description
A web-based tool that automates the creation of choropleth maps by performing spatial joins between CSV data and geographic boundary files. The platform eliminates the need for desktop GIS software by leveraging Census Bureau TIGER files and ESRI REST APIs to match geographic identifiers and generate export-ready visualizations.

## Core Functionality
- **Data Input:** Accepts CSV files with geographic identifiers (GEOID, ZIP, FIPS codes)
- **Geography Support:** Counties (5-digit), Sub-Counties/CCDs (10-digit), ZIP Codes (5-digit), Census Tracts (11-digit), Places/Cities (7-digit), States (2-digit)
- **Processing:** Performs automatic spatial joins between tabular data and geographic boundaries
- **Visualization:** Generates interactive choropleth maps with customizable classification methods (quantile, equal interval, natural breaks, standard deviation)
- **Export:** Produces GeoJSON and Shapefile formats compatible with ArcGIS Online/Pro

## Technical Stack
- **Frontend:** Vanilla JavaScript, Leaflet.js for mapping
- **Data Processing:** PapaParse for CSV parsing, Turf.js for geospatial operations
- **APIs:** U.S. Census Bureau TIGER, ESRI ArcGIS REST Services
- **Export:** ShpWrite for Shapefile generation
- **Hosting:** GitHub Pages (static site)

## Use Cases
1. **ALICE Population Mapping:** Visualizing Asset Limited, Income Constrained, Employed populations across Florida
2. **Disaster Response Planning:** Mapping vulnerable populations and resource allocation
3. **Demographic Analysis:** Creating publication-ready maps for reports and grants
4. **Resource Distribution:** Identifying geographic patterns in service delivery

## Key Features
- No software installation required (browser-based)
- Automatic geographic matching without manual joins
- Professional cartographic output
- Legend customization (5 color schemes, 4 classification methods, 3-9 class breaks)
- Handles malformed geographic codes automatically
- State-level filtering for large datasets

## Data Compatibility
- Census demographic data (ACS, Decennial)
- ALICE United Way datasets  
- Custom organizational data with geographic identifiers
- Any CSV with standard FIPS, ZIP, or place codes

## Performance Metrics
- Processes 1000+ geographic features in <3 seconds
- Handles CSV files up to 50MB
- Supports datasets with 50+ columns
- Tested with Florida's 67 counties, 400+ cities, 900+ ZIP codes

## Development Notes
- Built with American Red Cross design standards
- McKinsey-level professional interface
- Accessibility compliant
- Mobile responsive design
- Version controlled with semantic versioning

## Impact
Eliminates the need for ArcGIS Pro licenses ($700/user/year) and reduces map creation time from hours to minutes. Currently deployed for Red Cross disaster response planning and United Way ALICE data visualization.

---
*Last Updated: September 2025*