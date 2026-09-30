# Business experiment

Can a useful free Jenkins scanner acquire administrators of complex controllers, and will those administrators explicitly consider paying **$199/controller** for a future local upgrade rehearsal?

Primary funnel: **completed scans → qualified complex scans → paid-rehearsal CTA clicks → users stating willingness to pay $199**. These are product-intent signals, not revenue or validated purchases. Repeat scans are not unique people; report results per scan and also deduplicate lead emails during analysis. Avoid claiming conversion proves demand until follow-up conversations establish budget and urgency.

Initial qualification is configurable in `src/lib/scanner/complexity.ts`: HIGH/VERY HIGH complexity, OR at least 50 plugins and one blocker, OR at least two controllers reported in the beta form. The SQL below reads precomputed scan qualification and applies the controller rule to late-arriving leads. Keep the query's controller threshold aligned with the configuration when changing the experiment. Version rule changes in experiment notes before comparing cohorts.

Events: `scan_started` (rate-limited API attempt, no identifier or inventory), `scan_completed` (successful persisted report), `report_viewed`, `paid_rehearsal_cta_viewed` (intersection observer), `paid_rehearsal_cta_clicked`, `paid_rehearsal_interest_submitted` (transactionally confirmed). Views/clicks are deduplicated per scan; intent is stored once. Starts include malformed server submissions; client-only validation failures are not tracked.

```sql
with cohort as (
 select s.*, (s.qualified_complex or coalesce(l.controller_count,0)>=2) qualified,
 coalesce(l.stated_paid_interest,false) paid_interest
 from scans s left join leads l on l.scan_id=s.id
 where s.created_at>=now()-interval '30 days'
), flags as (
 select scan_id,
 bool_or(name='paid_rehearsal_cta_clicked') clicked,
 bool_or(name='paid_rehearsal_cta_viewed') viewed
 from events group by scan_id
)
select count(*) completed_scans,
 count(*) filter(where qualified) qualified_complex_scans,
 count(*) filter(where qualified and viewed) qualified_offer_views,
 count(*) filter(where qualified and clicked) qualified_offer_clicks,
 count(*) filter(where qualified and paid_interest) qualified_paid_intents,
 round(100.0*count(*) filter(where qualified and paid_interest)
 /nullif(count(*) filter(where qualified),0),1) qualified_intent_percent
from cohort left join flags on flags.scan_id=cohort.id;
```

Segment by complexity, plugin_count_bucket, java_migration_required, blocker_count, security_warning_count, current_jenkins_version, target_jenkins_version. No raw plugin inventory or contact details belong in an analytics export. No vanity traffic tracking is necessary.

## Retention job

Run monthly via a trusted database scheduler/operator (not a public endpoint):

```sql
begin;
delete from leads where created_at<now()-interval '180 days';
delete from scans where created_at<now()-interval '90 days'
 and not exists(select 1 from leads where leads.scan_id=scans.id);
delete from events where scan_id is null and created_at<now()-interval '90 days';
delete from rate_limits where window_start<now()-interval '1 day';
delete from metadata_snapshot where status='retired'
 and not exists(select 1 from scans where metadata_snapshot_id=metadata_snapshot.id);
commit;
```

Lead-associated scans survive until their lead expires (up to 180 days). Cascading deletion removes associated findings/events. Active public metadata has no private inventory. Retention is an operator task, not falsely advertised as an already-running scheduler. Before public launch, configure this job and a contact path for data deletion requests in the deployment's privacy notice.
