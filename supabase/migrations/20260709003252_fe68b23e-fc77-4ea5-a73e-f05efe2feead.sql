
CREATE POLICY "Auth read acessorio-imagens" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'acessorio-imagens');
CREATE POLICY "Auth insert acessorio-imagens" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'acessorio-imagens');
CREATE POLICY "Auth update acessorio-imagens" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'acessorio-imagens') WITH CHECK (bucket_id = 'acessorio-imagens');
CREATE POLICY "Auth delete acessorio-imagens" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'acessorio-imagens');
