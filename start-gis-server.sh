#!/bin/bash

# Easy GIS Database Server Startup Script
# Makes it super simple to share your 3.2GB database with both tools

echo "🗺️  GIS Database Server Startup"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "gis-api-server.py" ]; then
    echo "❌ Error: Please run this script from the choropleth-mapper directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected files: gis-api-server.py, data/ folder"
    exit 1
fi

# Check if data directory exists
if [ ! -d "data" ]; then
    echo "❌ Error: Data directory not found"
    echo "   Please ensure your 3.2GB database is in the 'data/' folder"
    exit 1
fi

# Check Python requirements
echo "🔍 Checking Python requirements..."

# Check if Flask is installed
python3 -c "import flask" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 Installing Flask (required for API server)..."
    pip3 install flask flask-cors pandas
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install requirements. Please run:"
        echo "   pip3 install flask flask-cors pandas"
        exit 1
    fi
fi

echo "✅ Python requirements satisfied"
echo ""

# Show database info
echo "📊 Database Information:"
echo "   Location: $(pwd)/data/"
echo "   Size: $(du -sh data/ | cut -f1)"
echo "   Files: $(find data/ -name "*.json" | wc -l) JSON datasets"
echo ""

# Start the server
echo "🚀 Starting GIS Database API Server..."
echo "   Server URL: http://localhost:5000"
echo "   API Docs: http://localhost:5000/api/datasets"
echo ""
echo "💡 Usage:"
echo "   - Your Choropleth Mapper: Already configured!"
echo "   - Universal Tool: Will access same database via API"
echo "   - Stop server: Press Ctrl+C"
echo ""
echo "=================================="
echo "🎯 Server starting in 3 seconds..."
sleep 3

# Start the Python server
python3 gis-api-server.py