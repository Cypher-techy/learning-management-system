-- Revenue share: 70% tutor / 30% platform.
-- Historical allocated periods intentionally keep the percentage and amounts
-- that were in force when they were distributed.

alter table revenue_periods
  alter column tutor_percent set default 70;

update revenue_periods
set tutor_percent = 70
where allocated = false;

-- Align already-materialised settings only when they use the known keys.
-- The running app also performs an equivalent content-version-7 migration
-- for its JSON/Postgres state store.
update platform_settings
set value = case
  when value ? 'tutorPercent' then jsonb_set(value, '{tutorPercent}', '70'::jsonb, false)
  when value ? 'tutor_percent' then jsonb_set(value, '{tutor_percent}', '70'::jsonb, false)
  else value
end
where key = 'settings'
  and jsonb_typeof(value) = 'object'
  and (value ? 'tutorPercent' or value ? 'tutor_percent');

update platform_settings
set value = '70'::jsonb
where key in ('tutorPercent', 'tutor_percent')
  and jsonb_typeof(value) = 'number';

comment on column revenue_periods.tutor_percent is
  'Tutor share percentage for this revenue period. New/unallocated periods default to 70% tutor / 30% platform; allocated periods retain their historical share.';
