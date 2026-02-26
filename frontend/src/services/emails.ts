import { supabase } from '../lib/supabase';

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: string;
  order_id: string | null;
  body_html: string | null;
  status: string;
  created_at: string;
}

export interface EmailSubscriber {
  id: string;
  email: string;
  name: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export async function fetchEmailLogs(): Promise<EmailLog[]> {
  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as EmailLog[];
}

export async function fetchSubscribers(): Promise<EmailSubscriber[]> {
  const { data, error } = await supabase
    .from('email_subscribers')
    .select('*')
    .order('subscribed_at', { ascending: false });
  if (error) throw error;
  return data as EmailSubscriber[];
}

export async function unsubscribe(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSubscriber(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_subscribers')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export type EmailAutomationSettings = Record<string, string>;

export async function fetchEmailAutomation(): Promise<EmailAutomationSettings> {
  const { data, error } = await supabase
    .from('email_automation')
    .select('key, value');
  if (error) throw error;
  return Object.fromEntries((data || []).map((r: { key: string; value: string }) => [r.key, r.value]));
}

export async function updateEmailAutomation(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('email_automation')
    .update({ value })
    .eq('key', key);
  if (error) throw error;
}
