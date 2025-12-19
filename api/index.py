import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import create_app



app = create_app()
