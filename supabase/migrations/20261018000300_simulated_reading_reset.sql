-- Let owners clear SIMULATED readings for their own plants so demo timelines
-- can be reset and replayed. Device and manual readings remain undeletable
-- from browsers: the measured history of a plant cannot be rewritten.

grant delete on public.sensor_readings to authenticated;

create policy "readings: delete simulated for own plants" on public.sensor_readings
  for delete to authenticated
  using (public.owns_plant(plant_id) and source = 'simulated');
