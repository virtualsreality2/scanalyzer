#!/bin/bash
# Build and validate Scanalyzer documentation

set -e

echo "🔨 Building Scanalyzer Documentation"
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_requirements() {
    echo "📋 Checking requirements..."
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is required but not installed${NC}"
        exit 1
    fi
    
    if ! command -v mkdocs &> /dev/null; then
        echo -e "${YELLOW}⚠️  MkDocs not found. Installing...${NC}"
        pip install mkdocs mkdocs-material mkdocs-minify-plugin mkdocs-git-revision-date-localized-plugin
    fi
    
    echo -e "${GREEN}✅ All requirements satisfied${NC}\n"
}

# Install dependencies
install_deps() {
    echo "📦 Installing dependencies..."
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}\n"
}

# Generate screenshots
generate_screenshots() {
    echo "📸 Generating screenshots..."
    
    # Start the application in the background
    echo "Starting application..."
    npm run dev &
    APP_PID=$!
    
    # Wait for app to be ready
    echo "Waiting for application to start..."
    sleep 10
    
    # Run screenshot generator
    ts-node scripts/generate-screenshots.ts --output docs/images/screenshots
    
    # Stop the application
    kill $APP_PID 2>/dev/null || true
    
    echo -e "${GREEN}✅ Screenshots generated${NC}\n"
}

# Validate documentation
validate_docs() {
    echo "🔍 Validating documentation..."
    
    if ts-node scripts/validate-docs.ts --docs docs; then
        echo -e "${GREEN}✅ Documentation validation passed${NC}\n"
    else
        echo -e "${RED}❌ Documentation validation failed${NC}"
        echo "Please fix the errors before building"
        exit 1
    fi
}

# Generate API documentation
generate_api_docs() {
    echo "🔧 Generating API documentation..."
    
    # TypeScript API docs
    npx typedoc --out docs/api-reference/typescript \
        --exclude "**/node_modules/**" \
        --exclude "**/tests/**" \
        --exclude "**/dist/**" \
        --name "Scanalyzer API" \
        frontend/src
    
    # Python API docs (if sphinx is available)
    if command -v sphinx-build &> /dev/null; then
        cd backend
        sphinx-apidoc -o ../docs/api-reference/python app
        cd ..
    fi
    
    echo -e "${GREEN}✅ API documentation generated${NC}\n"
}

# Build MkDocs site
build_mkdocs() {
    echo "📚 Building documentation site..."
    
    # Copy images if they don't exist
    if [ ! -d "docs/images" ]; then
        mkdir -p docs/images
        cp -r assets/images/* docs/images/ 2>/dev/null || true
    fi
    
    # Build the site
    mkdocs build --clean
    
    echo -e "${GREEN}✅ Documentation site built${NC}\n"
}

# Create offline documentation
create_offline_docs() {
    echo "📖 Creating offline documentation..."
    
    # Create PDF version
    if command -v mkdocs2pdf &> /dev/null; then
        mkdocs2pdf --output docs/Scanalyzer-Documentation.pdf
    else
        echo -e "${YELLOW}⚠️  mkdocs2pdf not found, skipping PDF generation${NC}"
    fi
    
    # Create EPUB version
    if command -v pandoc &> /dev/null; then
        pandoc docs/index.md docs/user-guide/**/*.md \
            -o docs/Scanalyzer-Documentation.epub \
            --toc --toc-depth=3 \
            --metadata title="Scanalyzer Documentation"
    else
        echo -e "${YELLOW}⚠️  pandoc not found, skipping EPUB generation${NC}"
    fi
    
    echo -e "${GREEN}✅ Offline documentation created${NC}\n"
}

# Deploy documentation
deploy_docs() {
    echo "🚀 Deploying documentation..."
    
    if [ "$1" == "--deploy" ]; then
        # Deploy to GitHub Pages
        mkdocs gh-deploy --force
        echo -e "${GREEN}✅ Documentation deployed to GitHub Pages${NC}\n"
    else
        echo "Skipping deployment (use --deploy flag to deploy)"
    fi
}

# Main build process
main() {
    echo "Starting at $(date)"
    echo
    
    check_requirements
    install_deps
    
    # Generate screenshots only if --screenshots flag is provided
    if [[ "$*" == *"--screenshots"* ]]; then
        generate_screenshots
    fi
    
    validate_docs
    generate_api_docs
    build_mkdocs
    create_offline_docs
    
    # Deploy if requested
    deploy_docs "$1"
    
    echo
    echo "======================================"
    echo -e "${GREEN}✨ Documentation build complete!${NC}"
    echo "======================================"
    echo
    echo "📁 Output locations:"
    echo "  - HTML site: ./site/"
    echo "  - PDF: ./docs/Scanalyzer-Documentation.pdf"
    echo "  - EPUB: ./docs/Scanalyzer-Documentation.epub"
    echo
    echo "🌐 To preview locally, run: mkdocs serve"
    echo "🚀 To deploy, run: ./scripts/build-docs.sh --deploy"
    echo
    echo "Completed at $(date)"
}

# Run main function with all arguments
main "$@"