const supabase = require('../supabase');

/* Generic Supabase Storage helpers, built on the raw client in
   ../supabase.js. Not called by anything right now — the bill-photo
   WhatsApp flow that used to need this was replaced with a text-only
   bill link (see services/whatsappService.js) — but kept ready for
   future uses (email attachments, logo hosting, etc.) per the
   "Future Ready" goal. */
async function uploadFile(bucket, fileName, buffer, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(fileName, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Supabase upload failed: ${error.message} (has the "${bucket}" bucket been created and made Public?)`);
  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  if (!data || !data.publicUrl) throw new Error('Could not get a public URL for the uploaded file');
  return data.publicUrl;
}

module.exports = { uploadFile };
