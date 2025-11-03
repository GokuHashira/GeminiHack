# --- Import all required modules ---
import google.generativeai as genai
from supabase import create_client, Client
from PIL import Image
import io
import json
import os
import copy
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# --- Global Variables for Clients ---
# These will be initialized during the 'lifespan' startup event
supabase: Client = None

# --- Server Startup & Shutdown Logic ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles server startup logic:
    - Configures Gemini from environment variables.
    - Creates the Supabase client from environment variables.
    """
    global supabase
    print("Server starting up...")
    try:
        # Configure Gemini
        API_KEY = os.environ.get('API_KEY', "AIzaSyCLLBitKQ98z22rwQ6xyeiEOe-l3TBMD6o")
        if not API_KEY:
            raise ValueError("API_KEY not found in environment variables. Please set it.")
        genai.configure(api_key=API_KEY)

        # Configure Supabase
        DB_URL = os.environ.get('DB_URL', "https://jdpjsijqjbnzggiakilr.supabase.co")
        DB_KEY = os.environ.get('DB_KEY', "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkcGpzaWpxamJuemdnaWFraWxyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjA5NDk0NywiZXhwIjoyMDc3NjcwOTQ3fQ.pILaVg0OGaHmJnpRCALg8pGLPaTK_OcMaP9WUJzpUTk") # Use SERVICE_ROLE key
        if not DB_URL or not DB_KEY:
            raise ValueError("Supabase credentials (DB_URL, DB_KEY) not found in environment variables.")
        
        supabase = create_client(DB_URL, DB_KEY)
        print("✅ Gemini and Supabase clients initialized successfully.")
    
    except Exception as e:
        print(f"--- ❌ Error during server startup ---")
        print(f"Error: {e}")
        # You might want to raise the error to stop the server if config fails
        # raise e 
    
    yield # The server is now running
    
    print("Server shutting down.")

# --- Create FastAPI App ---
app = FastAPI(lifespan=lifespan)

# Allow local dev origins; adjust as needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---
# --- All your functions from Colab go here ---
# ---

# --- UPDATED FUNCTION: Fetch *FRIENDS* from Supabase ---
def fetch_friends_from_supabase(current_user_id: str):
    """
    Fetches the user's private friend list from Supabase.
    This list will be injected into the Gemini prompt.
    """
    try:
        print(f"\nFetching friend list for user: {current_user_id}...")
        
        # This query joins 'friends' with 'members' to get the friend's details
        # It selects all 'members' records where the 'id' is in the
        # 'friend_id' column of the 'friends' table for the current user.
        response = supabase.table('friends').select('member_friends:members!friend_id (id, name)').eq('user_id', current_user_id).execute()
        
        if not response.data:
            print(f"No friends found for user {current_user_id}. Please add friends in the app first.")
            return []

        # The data is nested, so we extract it
        friends_list = [item['member_friends'] for item in response.data if item.get('member_friends')]
        
        if not friends_list:
             print(f"No friends found for user {current_user_id}. Please add friends in the app first.")
             return []

        print(f"Found {len(friends_list)} friends: {friends_list}")
        return friends_list
    
    except Exception as e:
        print(f"--- ❌ Error fetching friends from Supabase ---")
        print(f"Error: {e}")
        return None # Return None to indicate a failure

# --- UPDATED FUNCTION: Save to Supabase (Normalized) ---
def save_to_supabase(gemini_json: dict, instruction: str):
    """
    Saves the normalized JSON to 'expenses' and 'splits' tables in a transaction.
    The instruction text is saved in the 'description' field.
    Splits with a share of 0 are skipped.
    """
    try:
        print("\nAttempting to save to Supabase...")
        
        # Extract the data for each table
        expense_data = gemini_json.get("expense")
        splits_data = gemini_json.get("splits")
        
        if not expense_data or not splits_data:
            # This should be caught by the endpoint, but good to double-check
            raise ValueError("Gemini JSON missing 'expense' or 'splits' key.")

        # --- IMPORTANT: Add the instruction as the 'description' ---
        expense_data['description'] = instruction
        
        # 1. First, filter out any splits where share_cents is 0
        valid_splits_to_insert = [
            split for split in splits_data 
            if split.get('share_cents', 0) > 0
        ]
        
        # --- Simplified Transaction (for API) ---
        
        # 1. First, insert the main expense and get its new ID
        expense_response = supabase.table('expenses').insert(expense_data).execute()
        
        if not expense_response.data:
            raise Exception("Failed to insert expense. Aborting splits.")
            
        new_expense = expense_response.data[0]
        new_expense_id = new_expense['id']
        
        print(f"✅ Created expense record with new ID: {new_expense_id}")

        # 2. Prepare the splits data by adding the new expense_id to each split
        for split in valid_splits_to_insert:
            split['expense_id'] = new_expense_id
            
        # 3. Insert all valid splits in a single batch
        if valid_splits_to_insert:
            splits_response = supabase.table('splits').insert(valid_splits_to_insert).execute()
            print(f"✅ Successfully inserted {len(splits_response.data)} splits.")
        else:
            print(f"✅ Successfully saved expense {new_expense_id} (0 splits added).")
            
        print("✅ Database transaction complete.")
        
    except Exception as e:
        print(f"--- ❌ Error saving to Supabase: {e} ---")
        # Re-raise the exception so the API endpoint can catch it
        raise e

# --- STEP 3: The Core E2E Pipeline Function (Updated) ---
def process_bill_with_instructions(bill_image, split_instruction, friends_list, current_user_id):
    """
    This is the main backend logic.
    It sends the bill image, text instructions, and friend list to Gemini
    and requests a normalized JSON split that fits the DB schema.
    """
    
    # --- A. Define the "System Prompt" (Updated) ---
    # Convert friend list to a string for the prompt
    friends_list_string = json.dumps(friends_list)
    
    # Find the name of the current user
    current_user_name = "Me" # Default
    for friend in friends_list:
        if friend['id'] == current_user_id:
            current_user_name = friend['name']
            break
    
    system_prompt = f"""
    You are an expert expense-splitting AI for a bill-scanning app.
    Your job is to analyze a bill IMAGE and a TEXT instruction to create a
    perfectly structured JSON output that maps directly to a database.
    
    CONTEXT:
    - The user uploading this bill has id: {current_user_id}
    - The user who paid the bill is named "Me" or "{current_user_name}" and has id: {current_user_id}
    - The user's *only* available friends for splitting are: {friends_list_string}
    - The user's instruction is: "{split_instruction}"

    RULES:
    1.  **CURRENCY (CRITICAL):** The bill is in **USD**. All monetary values in the
        output JSON MUST be converted to **CENTS (an integer)**.
        Example: $12.34 becomes 1234.
    2.  **STRICT NAMING (CRITICAL):** You MUST use the exact `id`s from the
        friends list. Do NOT invent `id`s.
    3.  **VAGUE INSTRUCTIONS (CRITICAL):** If the instruction uses "we", "us", or "everyone"
        INSTEAD of explicit names (like "Sreenidhi and Srini"), you MUST return an error.
    4.  **TREATS:** If the user says they are "treating" or "it's on me",
        assign the entire cost to the payer's split and 0 to everyone else.
    5.  **CALCULATIONS:**
        - Calculate each person's subtotal based on the items they consumed.
        - Calculate a "proportionality" for each person (their_subtotal / bill_subtotal).
        - Each person's share of tax and tip MUST be calculated proportionally.
        - `share_cents` = (person's subtotal) + (person's tax share) + (person's tip share).
    6.  **OUTPUT:** You must return ONLY the JSON object and nothing else.

    ERROR HANDLING:
    - If the instruction is too vague (Rule #3), return this JSON:
      {{ "error_message": "Instruction is too vague. Please use explicit names instead of 'we' or 'us'." }}
    - If the bill is unreadable, return this JSON:
      {{ "error_message": "Bill is unreadable. Please upload a clearer image." }}
    """
    
    # --- B. Define the "JSON Schema" (Updated) ---
    # This schema forces Gemini to return JSON that matches your tables
    response_schema = {
        "type": "OBJECT",
        "properties": {
            "error_message": {"type": "STRING"},
            "expense": {
                "type": "OBJECT",
                "properties": {
                    "description": {"type": "STRING"},
                    "amount_cents": {"type": "INTEGER"},
                    "currency": {"type": "STRING", "enum": ["USD"]},
                    "payer_id": {"type": "STRING"},
                    "uploaded_by": {"type": "STRING"},
                    "bill": {
                        "type": "OBJECT",
                        "properties": {
                            "merchant_name": {"type": "STRING"},
                            "line_items": {
                                "type": "ARRAY",
                                "items": {
                                    "type": "OBJECT",
                                    "properties": {
                                        "description": {"type": "STRING"},
                                        "price_cents": {"type": "INTEGER"}
                                    },
                                    "required": ["description", "price_cents"]
                                }
                            },
                            "subtotal_cents": {"type": "INTEGER"},
                            "tax_cents": {"type": "INTEGER"},
                            "tip_cents": {"type": "INTEGER"}
                        },
                        "required": ["line_items", "subtotal_cents", "tax_cents", "tip_cents"]
                    },
                    "expense_time": {"type": "STRING", "format": "date-time"}
                },
                "required": [
                    "amount_cents",
                    "currency",
                    "payer_id",
                    "uploaded_by",
                    "bill",
                    "expense_time"
                ]
            },
            "splits": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "member_id": {"type": "STRING"},
                        "share_cents": {"type": "INTEGER"}
                    },
                    "required": ["member_id", "share_cents"]
                }
            }
        }
    }

    # --- C. Configure and Initialize the Model ---
    try:
        generation_config = genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=response_schema
        )
        
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash-preview-09-2025',
            system_instruction=system_prompt,
            generation_config=generation_config
        )
        print("\nGemini model initialized. Processing request...")

        # --- D. Make the API Call ---
        # We send both the image and the text instruction
        response = model.generate_content([bill_image, split_instruction])

        # --- E. Print and Return the Response ---
        print("\n--- ✅ E2E Pipeline Success (Gemini) ---")
        parsed_json = json.loads(response.text)
        print(json.dumps(parsed_json, indent=2))
        
        # Check for AI-detected errors
        if "error_message" in parsed_json:
            print(f"--- ⚠️ AI Error: {parsed_json['error_message']} ---")
            # Raise an exception that the endpoint can catch and return as an error
            raise HTTPException(status_code=400, detail=parsed_json['error_message'])

        return parsed_json
        
    except Exception as e:
        print(f"\n--- ❌ An Error Occurred (Gemini) ---")
        print(f"Error during API call: {e}")
        # Re-raise the exception to be caught by the endpoint
        raise e

# ---
# --- API Endpoint ---
# ---

@app.post("/upload-bill/")
def upload_bill_endpoint(
    # We use Form(...) because the request is multipart/form-data
    # (which is needed for a file upload)
    split_instruction: str = Form(...),
    current_user_id: str = Form(...), # In a real app, you'd get this from an Auth token
    bill_image: UploadFile = File(...)
):
    """
    This endpoint receives a bill image, split instructions, and a user ID.
    It processes the bill using Gemini and saves the normalized split
    to the Supabase database.
    """
    
    # Check if clients are initialized (from the lifespan event)
    if not supabase:
        raise HTTPException(status_code=503, detail="Server is not initialized. Check server logs.")

    # --- 1. Fetch User's Friends ---
    print("\n--- Step 1: Fetching Friend List ---")
    friends = fetch_friends_from_supabase(current_user_id)
    
    if friends is None:
        # This means fetch_friends_from_supabase had an exception
        raise HTTPException(status_code=500, detail="Error fetching friends from database.")
    
    # We must also add the user themselves to the list of "friends"
    # so Gemini can find them and assign them costs.
    try:
        user_res = supabase.table('members').select('id, name').eq('id', current_user_id).execute()
        if user_res.data and len(user_res.data) > 0:
            friends.append(user_res.data[0])  # Add the user themselves
        else:
            # Auto-provision a minimal members row if missing
            default_name = 'Me'
            insert_res = supabase.table('members').insert({
                'id': current_user_id,
                'name': default_name,
            }).execute()
            if insert_res.data and len(insert_res.data) > 0:
                friends.append(insert_res.data[0])
            else:
                raise HTTPException(status_code=404, detail=f"User {current_user_id} not found and could not be created in members table.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ensuring user in members table: {e}")

    # --- 2. Process the Image ---
    print("\n--- Step 2: Processing Uploaded Image ---")
    try:
        # Read the image file from the request
        image_bytes = bill_image.file.read()
        image = Image.open(io.BytesIO(image_bytes))
        print(f"Successfully processed image: {bill_image.filename}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {e}")

    # --- 3. Run the Pipeline ---
    print("\n--- Step 3: Processing Pipeline ---")
    try:
        gemini_result = process_bill_with_instructions(image, split_instruction, friends, current_user_id)
        
        # --- 4. Save to Database ---
        if gemini_result:
            print("\n--- Step 4: Saving to Database ---")
            save_to_supabase(gemini_result, split_instruction)
            # Send a success response back to the client
            return {"status": "success", "data": gemini_result}
        else:
            # This case should be handled by exceptions, but as a fallback:
            raise HTTPException(status_code=500, detail="Pipeline finished with no data to save.")
    except HTTPException as e:
        # This catches errors we raised on purpose (like "vague instructions")
        raise e
    except Exception as e:
        # This catches unexpected server errors
        print(f"--- ❌ Unhandled Exception in Pipeline: {e} ---")
        raise HTTPException(status_code=500, detail=str(e))

# New endpoint: process a bill already uploaded to Supabase Storage
@app.post("/process-stored-bill/")
def process_stored_bill_endpoint(
    split_instruction: str = Form(...),
    current_user_id: str = Form(...),
    file_path: str = Form(...),  # e.g., "<userId>/receipts/<filename>.jpg"
):
    """
    Expects a path of a file that is already uploaded to a Supabase Storage bucket.
    Downloads the image via Supabase client, runs Gemini, and saves to expenses/splits.
    Required env var: BUCKET_NAME
    """
    # Check initialization
    if not supabase:
        raise HTTPException(status_code=503, detail="Server is not initialized. Check server logs.")

    bucket = os.environ.get('BUCKET_NAME',"geminihackbucket")
    if not bucket:
        raise HTTPException(status_code=500, detail="BUCKET_NAME env var not set on server")

    # 1) Fetch user's friends (and include self)
    friends = fetch_friends_from_supabase(current_user_id)
    if friends is None:
        raise HTTPException(status_code=500, detail="Error fetching friends from database.")
    try:
        user_res = supabase.table('members').select('id, name').eq('id', current_user_id).execute()
        if user_res.data and len(user_res.data) > 0:
            friends.append(user_res.data[0])
        else:
            # Auto-create if missing
            default_name = 'Me'
            insert_res = supabase.table('members').insert({
                'id': current_user_id,
                'name': default_name,
            }).execute()
            if insert_res.data and len(insert_res.data) > 0:
                friends.append(insert_res.data[0])
            else:
                raise HTTPException(status_code=404, detail=f"User {current_user_id} not found and could not be created in members table.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ensuring user in members table: {e}")

    # 2) Download image bytes from Storage
    try:
        image_bytes = supabase.storage.from_(bucket).download(file_path)
        image = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not download/read image from storage: {e}")

    # 3) Run pipeline
    try:
        gemini_result = process_bill_with_instructions(image, split_instruction, friends, current_user_id)
        if not gemini_result:
            raise HTTPException(status_code=500, detail="Pipeline finished with no data to save.")
        # 4) Save to DB
        save_to_supabase(gemini_result, split_instruction)
        return {"status": "success", "data": gemini_result, "file_path": file_path}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# --- Add a simple root endpoint for testing ---
@app.get("/")
def read_root():
    return {"hello": "SplitScribe Bill-Scanning API is running"}
