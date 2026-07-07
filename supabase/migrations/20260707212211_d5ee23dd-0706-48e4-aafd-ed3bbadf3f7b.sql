
CREATE POLICY "pedido_anexos_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'pedido-anexos');

CREATE POLICY "pedido_anexos_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pedido-anexos' AND auth.uid() = owner);

CREATE POLICY "pedido_anexos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pedido-anexos' AND (auth.uid() = owner OR public.has_role(auth.uid(),'admin')));
