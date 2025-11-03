-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bills table
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  merchant TEXT,
  bill_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bill_participants table
CREATE TABLE public.bill_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  share_amount DECIMAL(10,2),
  paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bill_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_participants ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Bills RLS policies
CREATE POLICY "Users can view bills they participate in"
ON public.bills FOR SELECT
USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM public.bill_participants
    WHERE bill_id = id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create bills"
ON public.bills FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own bills"
ON public.bills FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own bills"
ON public.bills FOR DELETE USING (auth.uid() = created_by);

-- Bill participants RLS policies
CREATE POLICY "Users can view participants of their bills"
ON public.bill_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bills
    WHERE id = bill_id AND (
      created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.bill_participants bp
        WHERE bp.bill_id = id AND bp.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Bill creators can add participants"
ON public.bill_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bills
    WHERE id = bill_id AND created_by = auth.uid()
  )
);

CREATE POLICY "Bill creators can update participants"
ON public.bill_participants FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.bills
    WHERE id = bill_id AND created_by = auth.uid()
  )
);

CREATE POLICY "Bill creators can delete participants"
ON public.bill_participants FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.bills
    WHERE id = bill_id AND created_by = auth.uid()
  )
);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for bills updated_at
CREATE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();