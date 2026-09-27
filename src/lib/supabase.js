import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pdnbawzegvxoartmkmkj.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Rx1i8E9OTG5XNBvvGr3rbA_iBv9JvGO';

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
