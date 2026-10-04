import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_accounts_entity_type" AS ENUM('individual', 'organization');
  CREATE TYPE "public"."enum_accounts_membership_track" AS ENUM('network', 'constituency_work');
  CREATE TYPE "public"."enum_accounts_member_status" AS ENUM('pending_course', 'verified', 'suspended');
  CREATE TYPE "public"."enum_accounts_hub_access_status" AS ENUM('pending_course', 'active', 'suspended');
  CREATE TYPE "public"."enum_accounts_membership_status" AS ENUM('registered', 'course_passed', 'awaiting_onboarding', 'active', 'renewal_due', 'expired', 'terminated', 'rejected');
  CREATE TYPE "public"."enum_accounts_constituency_work_status" AS ENUM('', 'pending_onboarding', 'active');
  CREATE TYPE "public"."enum_accounts_role" AS ENUM('member', 'admin', 'focal_point', 'wg_contact', 'ngo_admin');
  CREATE TYPE "public"."enum_assignments_scope_type" AS ENUM('team', 'working_group', 'negotiation_track', 'negotiation_project', 'platform_body', 'body', 'organization', 'platform');
  CREATE TYPE "public"."enum_assignments_status" AS ENUM('active', 'inactive', 'expired');
  CREATE TYPE "public"."enum_member_profiles_directory_visibility" AS ENUM('private', 'members', 'public');
  CREATE TYPE "public"."enum_wg_progress_status" AS ENUM('interested', 'active', 'inactive');
  CREATE TYPE "public"."enum_wg_progress_role_in_wg" AS ENUM('member', 'contact', 'lead');
  CREATE TYPE "public"."enum_content_submissions_status" AS ENUM('open', 'drafting', 'internal_review', 'submitted', 'archived');
  CREATE TYPE "public"."enum_council_decisions_status" AS ENUM('proposed', 'open_for_input', 'objection_window', 'adopted', 'rejected', 'withdrawn');
  CREATE TYPE "public"."enum_content_coys_type" AS ENUM('coy', 'lcoy', 'rcoy', 'other');
  CREATE TYPE "public"."enum_content_coys_review_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_catalogue_resources_verification_status" AS ENUM('verified', 'needs_verification', 'flagged', 'retired');
  CREATE TYPE "public"."enum_opportunities_kind" AS ENUM('event', 'workshop', 'hackathon', 'opportunity', 'call', 'training');
  CREATE TYPE "public"."enum_opportunities_format" AS ENUM('online', 'in_person', 'hybrid');
  CREATE TYPE "public"."enum_opportunities_status" AS ENUM('draft', 'pending_review', 'published', 'withdrawn', 'rejected');
  CREATE TYPE "public"."enum_feedback_tickets_kind" AS ENUM('bug', 'ui_ux', 'feature', 'blocker', 'content', 'other');
  CREATE TYPE "public"."enum_feedback_tickets_severity" AS ENUM('low', 'normal', 'high', 'critical');
  CREATE TYPE "public"."enum_feedback_tickets_status" AS ENUM('new', 'triaged', 'in_progress', 'resolved', 'declined');
  CREATE TYPE "public"."enum_gys_workflow_cycles_status" AS ENUM('planning', 'intake', 'synthesis', 'review', 'consultation', 'approved', 'published', 'archived');
  CREATE TYPE "public"."enum_gys_tracked_contributions_status" AS ENUM('submitted', 'triaged', 'drafting', 'needs_review', 'approved', 'rejected', 'published');
  CREATE TYPE "public"."enum_cp_call_slots_status" AS ENUM('open', 'booked', 'cancelled');
  CREATE TYPE "public"."enum_content_drafts_content_type" AS ENUM('event', 'announcement', 'resource', 'coy', 'opportunity');
  CREATE TYPE "public"."enum_content_drafts_status" AS ENUM('draft', 'in_review', 'changes_requested', 'approved', 'published', 'rejected');
  CREATE TYPE "public"."enum_ngo_seats_seat_role" AS ENUM('owner', 'representative', 'viewer', 'affiliate');
  CREATE TYPE "public"."enum_ngo_seats_status" AS ENUM('invited', 'requested', 'active', 'revoked', 'declined');
  CREATE TYPE "public"."enum_ngo_requests_status" AS ENUM('pending', 'approved', 'declined');
  CREATE TYPE "public"."enum_membership_appeals_status" AS ENUM('pending', 'approved', 'declined');
  CREATE TYPE "public"."enum_resource_issues_kind" AS ENUM('broken', 'outdated', 'tags', 'duplicate', 'other');
  CREATE TYPE "public"."enum_resource_reviews_status" AS ENUM('verified', 'needs_changes', 'retired');
  CREATE TYPE "public"."enum_research_notes_kind" AS ENUM('research_note');
  CREATE TYPE "public"."enum_research_notes_status" AS ENUM('draft', 'pending_review', 'approved', 'applied', 'rejected');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "accounts_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "accounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"first_name" varchar,
  	"last_name" varchar,
  	"phone" varchar,
  	"gender" varchar,
  	"gender_other" varchar,
  	"age_band" varchar,
  	"date_of_birth" timestamp(3) with time zone,
  	"minority_groups" jsonb,
  	"minority_other" varchar,
  	"region" varchar,
  	"nationality" varchar,
  	"country" varchar NOT NULL,
  	"motivation" varchar,
  	"entity_type" "enum_accounts_entity_type" DEFAULT 'individual' NOT NULL,
  	"membership_track" "enum_accounts_membership_track" DEFAULT 'network' NOT NULL,
  	"organization_name" varchar,
  	"organization_type" varchar,
  	"is_unfccc_admitted" boolean DEFAULT false,
  	"org_operate_in" varchar,
  	"org_website" varchar,
  	"org_social" varchar,
  	"org_mission" varchar,
  	"dcp_name" varchar,
  	"dcp_email" varchar,
  	"dcp_phone" varchar,
  	"ycp_name" varchar,
  	"ycp_email" varchar,
  	"ycp_phone" varchar,
  	"under18" boolean DEFAULT false,
  	"guardian_name" varchar,
  	"guardian_email" varchar,
  	"guardian_consent" boolean DEFAULT false,
  	"member_of_accredited_ngo" boolean DEFAULT false,
  	"coi_declared" boolean DEFAULT false,
  	"coi_details" varchar,
  	"policies_accepted" boolean DEFAULT false,
  	"membership_policy_version" varchar,
  	"privacy_consent" boolean DEFAULT false,
  	"privacy_consent_at" timestamp(3) with time zone,
  	"privacy_notice_version" varchar,
  	"privacy_consent_withdrawn_at" timestamp(3) with time zone,
  	"member_status" "enum_accounts_member_status" DEFAULT 'pending_course',
  	"hub_access_status" "enum_accounts_hub_access_status" DEFAULT 'pending_course',
  	"membership_status" "enum_accounts_membership_status" DEFAULT 'registered',
  	"constituency_work_status" "enum_accounts_constituency_work_status",
  	"onboarding_cohort" varchar,
  	"renewal_due_at" timestamp(3) with time zone,
  	"membership_ended_at" timestamp(3) with time zone,
  	"membership_end_reason" varchar,
  	"role" "enum_accounts_role" DEFAULT 'member' NOT NULL,
  	"team_roles" jsonb,
  	"wg_interests" jsonb,
  	"appointment_evidence" jsonb,
  	"course_passed_at" timestamp(3) with time zone,
  	"course_score" numeric,
  	"verified_at" timestamp(3) with time zone,
  	"email_verified_at" timestamp(3) with time zone,
  	"must_change_password" boolean DEFAULT false,
  	"legacy_password_hash" varchar,
  	"legacy_password_salt" varchar,
  	"last_login_at" timestamp(3) with time zone,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "assignments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"scope_type" "enum_assignments_scope_type" NOT NULL,
  	"scope_id" varchar NOT NULL,
  	"role" varchar DEFAULT 'member' NOT NULL,
  	"appointment_evidence" varchar,
  	"status" "enum_assignments_status" DEFAULT 'active' NOT NULL,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"assigned_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "member_profiles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"display_name" varchar NOT NULL,
  	"headline" varchar,
  	"bio" varchar,
  	"pronouns" varchar,
  	"expertise_tags" jsonb,
  	"directory_visibility" "enum_member_profiles_directory_visibility" DEFAULT 'private',
  	"show_country" boolean DEFAULT false,
  	"show_organization" boolean DEFAULT false,
  	"show_working_groups" boolean DEFAULT true,
  	"show_roles" boolean DEFAULT true,
  	"role_title" varchar,
  	"revision" numeric DEFAULT 1,
  	"photo_id" integer,
  	"has_photo" boolean DEFAULT false,
  	"photo_updated_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "working_groups_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "working_groups_resources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"description" varchar,
  	"url" varchar NOT NULL,
  	"visibility" varchar
  );
  
  CREATE TABLE "working_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"monogram" varchar,
  	"focus_line" varchar,
  	"description" varchar,
  	"cadence_note" varchar,
  	"topic" varchar,
  	"task_forces" jsonb,
  	"whatsapp_url" varchar,
  	"group_url" varchar,
  	"drive_url" varchar,
  	"public_space" boolean DEFAULT false,
  	"is_active" boolean DEFAULT true,
  	"sort_order" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wg_progress" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"wg_slug" varchar NOT NULL,
  	"presentation_ok" boolean DEFAULT false,
  	"rules_ok" boolean DEFAULT false,
  	"unlocked_at" timestamp(3) with time zone,
  	"joined_at" timestamp(3) with time zone,
  	"status" "enum_wg_progress_status" DEFAULT 'interested',
  	"role_in_wg" "enum_wg_progress_role_in_wg" DEFAULT 'member',
  	"onboarded_by" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "content_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"type" varchar DEFAULT 'wg_call' NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"ends_at" timestamp(3) with time zone,
  	"description" varchar,
  	"wg_id" integer,
  	"meeting_url" varchar,
  	"recording_url" varchar,
  	"legacy_source" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "content_announcements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"pinned" boolean DEFAULT false,
  	"cta_url" varchar,
  	"cta_label" varchar,
  	"cta_deadline_at" timestamp(3) with time zone,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "content_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"status" "enum_content_submissions_status" DEFAULT 'open' NOT NULL,
  	"deadline_at" timestamp(3) with time zone,
  	"wg_id" integer,
  	"draft_url" varchar,
  	"final_url" varchar,
  	"unfccc_url" varchar,
  	"contribute_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "council_decisions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"status" "enum_council_decisions_status" DEFAULT 'proposed' NOT NULL,
  	"summary" varchar,
  	"proposer" varchar DEFAULT 'Focal points',
  	"proposal_url" varchar,
  	"final_url" varchar,
  	"respond_note" varchar,
  	"outcome_note" varchar,
  	"input_deadline" timestamp(3) with time zone,
  	"objection_deadline" timestamp(3) with time zone,
  	"decided_at" timestamp(3) with time zone,
  	"status_log" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "content_coys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"type" "enum_content_coys_type" DEFAULT 'coy' NOT NULL,
  	"title" varchar NOT NULL,
  	"country" varchar,
  	"city" varchar,
  	"region" varchar,
  	"starts_on" varchar,
  	"ends_on" varchar,
  	"dates_tbc" boolean DEFAULT false,
  	"status" varchar,
  	"applications_close_at" timestamp(3) with time zone,
  	"review_status" "enum_content_coys_review_status" DEFAULT 'pending',
  	"organizer_name" varchar,
  	"organizer_org" varchar,
  	"register_url" varchar,
  	"website_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "directory_contacts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"group" varchar NOT NULL,
  	"role_title" varchar NOT NULL,
  	"description" varchar,
  	"public_email" varchar,
  	"wg_id" integer,
  	"person_name" varchar,
  	"channel_value" varchar,
  	"sort_order" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "catalogue_resources" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"summary" varchar,
  	"publisher" varchar,
  	"pathway" varchar,
  	"type" varchar,
  	"topic" varchar,
  	"topics" jsonb,
  	"region" varchar,
  	"language" varchar,
  	"source" varchar,
  	"verification_status" "enum_catalogue_resources_verification_status" DEFAULT 'needs_verification',
  	"checked_at" timestamp(3) with time zone,
  	"retired_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "opportunities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"kind" "enum_opportunities_kind" DEFAULT 'call' NOT NULL,
  	"title" varchar NOT NULL,
  	"summary" varchar,
  	"body" varchar,
  	"format" "enum_opportunities_format" DEFAULT 'online',
  	"location" varchar,
  	"region" varchar,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"deadline_at" timestamp(3) with time zone,
  	"link_url" varchar,
  	"organization_name" varchar,
  	"org_account_id" integer,
  	"status" "enum_opportunities_status" DEFAULT 'published' NOT NULL,
  	"review_note" varchar,
  	"reviewed_at" timestamp(3) with time zone,
  	"source" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "feedback_tickets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"kind" "enum_feedback_tickets_kind" NOT NULL,
  	"severity" "enum_feedback_tickets_severity" DEFAULT 'normal' NOT NULL,
  	"body" varchar NOT NULL,
  	"page_url" varchar,
  	"context_note" varchar,
  	"account_id" integer,
  	"contact_email" varchar,
  	"status" "enum_feedback_tickets_status" DEFAULT 'new' NOT NULL,
  	"triage_note" varchar,
  	"github_issue_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gys_cycles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" numeric NOT NULL,
  	"edition" varchar,
  	"title" varchar NOT NULL,
  	"location" varchar,
  	"target_session" varchar,
  	"intro" varchar,
  	"note" varchar,
  	"full_url" varchar,
  	"inputs_url" varchar,
  	"inputs_deadline_at" timestamp(3) with time zone,
  	"release_url" varchar,
  	"priorities" jsonb,
  	"process" jsonb,
  	"archive" jsonb,
  	"is_current" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gys_contributions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cycle" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"country" varchar,
  	"organization" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gys_workflow_cycles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"year" numeric NOT NULL,
  	"status" "enum_gys_workflow_cycles_status" DEFAULT 'intake' NOT NULL,
  	"opens_at" timestamp(3) with time zone,
  	"closes_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gys_tracked_contributions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cycle_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar,
  	"theme" varchar,
  	"region" varchar,
  	"country" varchar,
  	"submitter_type" varchar,
  	"organization" varchar,
  	"source" varchar DEFAULT 'manual',
  	"external_id" varchar,
  	"raw_answers" jsonb,
  	"author_id" integer,
  	"reviewer_id" integer,
  	"status" "enum_gys_tracked_contributions_status" DEFAULT 'submitted' NOT NULL,
  	"version" numeric DEFAULT 1,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wg_activities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"wg_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"note" varchar,
  	"kind" varchar DEFAULT 'update',
  	"link_url" varchar,
  	"posted_by_id" integer,
  	"posted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cp_call_slots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"host_account_id" integer NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"duration_min" numeric DEFAULT 20,
  	"meeting_url" varchar,
  	"status" "enum_cp_call_slots_status" DEFAULT 'open' NOT NULL,
  	"booked_by_account_id" integer,
  	"booked_at" timestamp(3) with time zone,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "content_drafts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"content_type" "enum_content_drafts_content_type" NOT NULL,
  	"content_key" varchar NOT NULL,
  	"status" "enum_content_drafts_status" DEFAULT 'draft' NOT NULL,
  	"payload" jsonb NOT NULL,
  	"author_id" integer,
  	"reviewer_id" integer,
  	"review_note" varchar,
  	"published_at" timestamp(3) with time zone,
  	"revision" numeric DEFAULT 1,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "consultation_contributions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" varchar NOT NULL,
  	"name" varchar,
  	"email" varchar,
  	"organization" varchar,
  	"body" varchar,
  	"meta" jsonb,
  	"consent_given" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "password_resets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"email" varchar NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ngo_seats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"org_account_id" integer NOT NULL,
  	"member_account_id" integer,
  	"email" varchar,
  	"name" varchar,
  	"seat_role" "enum_ngo_seats_seat_role" DEFAULT 'representative' NOT NULL,
  	"status" "enum_ngo_seats_status" DEFAULT 'invited' NOT NULL,
  	"invite_token_hash" varchar,
  	"invite_expires_at" timestamp(3) with time zone,
  	"invited_by_id" integer,
  	"accepted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ngo_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"org_account_id" integer NOT NULL,
  	"kind" varchar NOT NULL,
  	"title" varchar,
  	"body" varchar,
  	"meta" jsonb,
  	"status" "enum_ngo_requests_status" DEFAULT 'pending',
  	"decided_by_id" integer,
  	"decided_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "membership_appeals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"statement" varchar NOT NULL,
  	"identity_kind" varchar,
  	"proof_id" integer,
  	"proof_content_type" varchar,
  	"proof_byte_size" numeric,
  	"status" "enum_membership_appeals_status" DEFAULT 'pending',
  	"review_note" varchar,
  	"reviewed_by_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "notification_prefs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"timezone" varchar DEFAULT 'UTC',
  	"digest_day" numeric DEFAULT 1,
  	"digest_hour_utc" numeric DEFAULT 6,
  	"email" jsonb,
  	"push_enabled" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"actor_id" integer,
  	"actor_email" varchar,
  	"action" varchar NOT NULL,
  	"target_type" varchar,
  	"target_id" varchar,
  	"reason" varchar,
  	"before" jsonb,
  	"after" jsonb,
  	"request_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "push_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"endpoint" varchar NOT NULL,
  	"keys" jsonb NOT NULL,
  	"user_agent" varchar,
  	"disabled_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "resource_issues" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"resource_slug" varchar NOT NULL,
  	"kind" "enum_resource_issues_kind" NOT NULL,
  	"detail" varchar NOT NULL,
  	"reported_by_id" integer,
  	"resolved_at" timestamp(3) with time zone,
  	"resolved_by_id" integer,
  	"review_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "resource_reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"resource_slug" varchar NOT NULL,
  	"fingerprint" varchar,
  	"status" "enum_resource_reviews_status" NOT NULL,
  	"note" varchar,
  	"checks" jsonb,
  	"reviewed_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "research_notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"kind" "enum_research_notes_kind" DEFAULT 'research_note',
  	"title" varchar NOT NULL,
  	"note" varchar NOT NULL,
  	"citations" jsonb NOT NULL,
  	"status" "enum_research_notes_status" DEFAULT 'draft',
  	"idempotency_key" varchar,
  	"approved_by_id" integer,
  	"applied_by_id" integer,
  	"applied_at" timestamp(3) with time zone,
  	"reviewed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "email_verification_tokens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "negotiation_tracks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"topic" varchar NOT NULL,
  	"summary" varchar,
  	"activity_status" varchar,
  	"working_group_slugs" jsonb,
  	"published" boolean DEFAULT false,
  	"agenda_items" jsonb,
  	"calls" jsonb,
  	"documents" jsonb,
  	"notice" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "negotiation_projects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"track_slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"summary" varchar,
  	"status" varchar DEFAULT 'open',
  	"scope" jsonb,
  	"created_by_id" integer,
  	"versions" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "negotiation_follows" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"track_slug" varchar NOT NULL,
  	"preferences" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "negotiation_amendments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"track_slug" varchar,
  	"project_id" varchar,
  	"title" varchar,
  	"kind" varchar,
  	"status" varchar DEFAULT 'draft',
  	"text" varchar,
  	"rationale" varchar,
  	"citations" jsonb,
  	"submitted_by_id" integer,
  	"versions" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"accounts_id" integer,
  	"assignments_id" integer,
  	"member_profiles_id" integer,
  	"working_groups_id" integer,
  	"wg_progress_id" integer,
  	"content_events_id" integer,
  	"content_announcements_id" integer,
  	"content_submissions_id" integer,
  	"council_decisions_id" integer,
  	"content_coys_id" integer,
  	"directory_contacts_id" integer,
  	"catalogue_resources_id" integer,
  	"opportunities_id" integer,
  	"feedback_tickets_id" integer,
  	"gys_cycles_id" integer,
  	"gys_contributions_id" integer,
  	"gys_workflow_cycles_id" integer,
  	"gys_tracked_contributions_id" integer,
  	"wg_activities_id" integer,
  	"cp_call_slots_id" integer,
  	"content_drafts_id" integer,
  	"consultation_contributions_id" integer,
  	"password_resets_id" integer,
  	"ngo_seats_id" integer,
  	"ngo_requests_id" integer,
  	"membership_appeals_id" integer,
  	"notification_prefs_id" integer,
  	"audit_log_id" integer,
  	"push_subscriptions_id" integer,
  	"resource_issues_id" integer,
  	"resource_reviews_id" integer,
  	"research_notes_id" integer,
  	"email_verification_tokens_id" integer,
  	"negotiation_tracks_id" integer,
  	"negotiation_projects_id" integer,
  	"negotiation_follows_id" integer,
  	"negotiation_amendments_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"accounts_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "accounts_sessions" ADD CONSTRAINT "accounts_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "assignments" ADD CONSTRAINT "assignments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_by_id_accounts_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "working_groups_tags" ADD CONSTRAINT "working_groups_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."working_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "working_groups_resources" ADD CONSTRAINT "working_groups_resources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."working_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wg_progress" ADD CONSTRAINT "wg_progress_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_events" ADD CONSTRAINT "content_events_wg_id_working_groups_id_fk" FOREIGN KEY ("wg_id") REFERENCES "public"."working_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_wg_id_working_groups_id_fk" FOREIGN KEY ("wg_id") REFERENCES "public"."working_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "directory_contacts" ADD CONSTRAINT "directory_contacts_wg_id_working_groups_id_fk" FOREIGN KEY ("wg_id") REFERENCES "public"."working_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_org_account_id_accounts_id_fk" FOREIGN KEY ("org_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gys_tracked_contributions" ADD CONSTRAINT "gys_tracked_contributions_cycle_id_gys_workflow_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."gys_workflow_cycles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gys_tracked_contributions" ADD CONSTRAINT "gys_tracked_contributions_author_id_accounts_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gys_tracked_contributions" ADD CONSTRAINT "gys_tracked_contributions_reviewer_id_accounts_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wg_activities" ADD CONSTRAINT "wg_activities_wg_id_working_groups_id_fk" FOREIGN KEY ("wg_id") REFERENCES "public"."working_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wg_activities" ADD CONSTRAINT "wg_activities_posted_by_id_accounts_id_fk" FOREIGN KEY ("posted_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cp_call_slots" ADD CONSTRAINT "cp_call_slots_host_account_id_accounts_id_fk" FOREIGN KEY ("host_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cp_call_slots" ADD CONSTRAINT "cp_call_slots_booked_by_account_id_accounts_id_fk" FOREIGN KEY ("booked_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_author_id_accounts_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_reviewer_id_accounts_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ngo_seats" ADD CONSTRAINT "ngo_seats_org_account_id_accounts_id_fk" FOREIGN KEY ("org_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ngo_seats" ADD CONSTRAINT "ngo_seats_member_account_id_accounts_id_fk" FOREIGN KEY ("member_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ngo_seats" ADD CONSTRAINT "ngo_seats_invited_by_id_accounts_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ngo_requests" ADD CONSTRAINT "ngo_requests_org_account_id_accounts_id_fk" FOREIGN KEY ("org_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ngo_requests" ADD CONSTRAINT "ngo_requests_decided_by_id_accounts_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "membership_appeals" ADD CONSTRAINT "membership_appeals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "membership_appeals" ADD CONSTRAINT "membership_appeals_proof_id_media_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "membership_appeals" ADD CONSTRAINT "membership_appeals_reviewed_by_id_accounts_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_accounts_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "resource_issues" ADD CONSTRAINT "resource_issues_reported_by_id_accounts_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "resource_issues" ADD CONSTRAINT "resource_issues_resolved_by_id_accounts_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "resource_reviews" ADD CONSTRAINT "resource_reviews_reviewed_by_id_accounts_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "research_notes" ADD CONSTRAINT "research_notes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "research_notes" ADD CONSTRAINT "research_notes_approved_by_id_accounts_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "research_notes" ADD CONSTRAINT "research_notes_applied_by_id_accounts_id_fk" FOREIGN KEY ("applied_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "negotiation_projects" ADD CONSTRAINT "negotiation_projects_created_by_id_accounts_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "negotiation_follows" ADD CONSTRAINT "negotiation_follows_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "negotiation_amendments" ADD CONSTRAINT "negotiation_amendments_submitted_by_id_accounts_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_accounts_fk" FOREIGN KEY ("accounts_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_assignments_fk" FOREIGN KEY ("assignments_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_profiles_fk" FOREIGN KEY ("member_profiles_id") REFERENCES "public"."member_profiles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_working_groups_fk" FOREIGN KEY ("working_groups_id") REFERENCES "public"."working_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wg_progress_fk" FOREIGN KEY ("wg_progress_id") REFERENCES "public"."wg_progress"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_content_events_fk" FOREIGN KEY ("content_events_id") REFERENCES "public"."content_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_content_announcements_fk" FOREIGN KEY ("content_announcements_id") REFERENCES "public"."content_announcements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_content_submissions_fk" FOREIGN KEY ("content_submissions_id") REFERENCES "public"."content_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_council_decisions_fk" FOREIGN KEY ("council_decisions_id") REFERENCES "public"."council_decisions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_content_coys_fk" FOREIGN KEY ("content_coys_id") REFERENCES "public"."content_coys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_directory_contacts_fk" FOREIGN KEY ("directory_contacts_id") REFERENCES "public"."directory_contacts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_catalogue_resources_fk" FOREIGN KEY ("catalogue_resources_id") REFERENCES "public"."catalogue_resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opportunities_fk" FOREIGN KEY ("opportunities_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_feedback_tickets_fk" FOREIGN KEY ("feedback_tickets_id") REFERENCES "public"."feedback_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gys_cycles_fk" FOREIGN KEY ("gys_cycles_id") REFERENCES "public"."gys_cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gys_contributions_fk" FOREIGN KEY ("gys_contributions_id") REFERENCES "public"."gys_contributions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gys_workflow_cycles_fk" FOREIGN KEY ("gys_workflow_cycles_id") REFERENCES "public"."gys_workflow_cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gys_tracked_contributions_fk" FOREIGN KEY ("gys_tracked_contributions_id") REFERENCES "public"."gys_tracked_contributions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wg_activities_fk" FOREIGN KEY ("wg_activities_id") REFERENCES "public"."wg_activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cp_call_slots_fk" FOREIGN KEY ("cp_call_slots_id") REFERENCES "public"."cp_call_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_content_drafts_fk" FOREIGN KEY ("content_drafts_id") REFERENCES "public"."content_drafts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consultation_contributions_fk" FOREIGN KEY ("consultation_contributions_id") REFERENCES "public"."consultation_contributions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_password_resets_fk" FOREIGN KEY ("password_resets_id") REFERENCES "public"."password_resets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ngo_seats_fk" FOREIGN KEY ("ngo_seats_id") REFERENCES "public"."ngo_seats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ngo_requests_fk" FOREIGN KEY ("ngo_requests_id") REFERENCES "public"."ngo_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_membership_appeals_fk" FOREIGN KEY ("membership_appeals_id") REFERENCES "public"."membership_appeals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notification_prefs_fk" FOREIGN KEY ("notification_prefs_id") REFERENCES "public"."notification_prefs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk" FOREIGN KEY ("push_subscriptions_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_resource_issues_fk" FOREIGN KEY ("resource_issues_id") REFERENCES "public"."resource_issues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_resource_reviews_fk" FOREIGN KEY ("resource_reviews_id") REFERENCES "public"."resource_reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_research_notes_fk" FOREIGN KEY ("research_notes_id") REFERENCES "public"."research_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_verification_tokens_fk" FOREIGN KEY ("email_verification_tokens_id") REFERENCES "public"."email_verification_tokens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_negotiation_tracks_fk" FOREIGN KEY ("negotiation_tracks_id") REFERENCES "public"."negotiation_tracks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_negotiation_projects_fk" FOREIGN KEY ("negotiation_projects_id") REFERENCES "public"."negotiation_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_negotiation_follows_fk" FOREIGN KEY ("negotiation_follows_id") REFERENCES "public"."negotiation_follows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_negotiation_amendments_fk" FOREIGN KEY ("negotiation_amendments_id") REFERENCES "public"."negotiation_amendments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_accounts_fk" FOREIGN KEY ("accounts_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "accounts_sessions_order_idx" ON "accounts_sessions" USING btree ("_order");
  CREATE INDEX "accounts_sessions_parent_id_idx" ON "accounts_sessions" USING btree ("_parent_id");
  CREATE INDEX "accounts_membership_status_idx" ON "accounts" USING btree ("membership_status");
  CREATE INDEX "accounts_legacy_id_idx" ON "accounts" USING btree ("legacy_id");
  CREATE INDEX "accounts_updated_at_idx" ON "accounts" USING btree ("updated_at");
  CREATE INDEX "accounts_created_at_idx" ON "accounts" USING btree ("created_at");
  CREATE UNIQUE INDEX "accounts_email_idx" ON "accounts" USING btree ("email");
  CREATE INDEX "assignments_account_idx" ON "assignments" USING btree ("account_id");
  CREATE INDEX "assignments_scope_id_idx" ON "assignments" USING btree ("scope_id");
  CREATE INDEX "assignments_status_idx" ON "assignments" USING btree ("status");
  CREATE INDEX "assignments_assigned_by_idx" ON "assignments" USING btree ("assigned_by_id");
  CREATE INDEX "assignments_updated_at_idx" ON "assignments" USING btree ("updated_at");
  CREATE INDEX "assignments_created_at_idx" ON "assignments" USING btree ("created_at");
  CREATE UNIQUE INDEX "member_profiles_account_idx" ON "member_profiles" USING btree ("account_id");
  CREATE INDEX "member_profiles_photo_idx" ON "member_profiles" USING btree ("photo_id");
  CREATE INDEX "member_profiles_updated_at_idx" ON "member_profiles" USING btree ("updated_at");
  CREATE INDEX "member_profiles_created_at_idx" ON "member_profiles" USING btree ("created_at");
  CREATE INDEX "working_groups_tags_order_idx" ON "working_groups_tags" USING btree ("_order");
  CREATE INDEX "working_groups_tags_parent_id_idx" ON "working_groups_tags" USING btree ("_parent_id");
  CREATE INDEX "working_groups_resources_order_idx" ON "working_groups_resources" USING btree ("_order");
  CREATE INDEX "working_groups_resources_parent_id_idx" ON "working_groups_resources" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "working_groups_slug_idx" ON "working_groups" USING btree ("slug");
  CREATE INDEX "working_groups_updated_at_idx" ON "working_groups" USING btree ("updated_at");
  CREATE INDEX "working_groups_created_at_idx" ON "working_groups" USING btree ("created_at");
  CREATE INDEX "wg_progress_account_idx" ON "wg_progress" USING btree ("account_id");
  CREATE INDEX "wg_progress_wg_slug_idx" ON "wg_progress" USING btree ("wg_slug");
  CREATE INDEX "wg_progress_status_idx" ON "wg_progress" USING btree ("status");
  CREATE INDEX "wg_progress_updated_at_idx" ON "wg_progress" USING btree ("updated_at");
  CREATE INDEX "wg_progress_created_at_idx" ON "wg_progress" USING btree ("created_at");
  CREATE UNIQUE INDEX "content_events_slug_idx" ON "content_events" USING btree ("slug");
  CREATE INDEX "content_events_type_idx" ON "content_events" USING btree ("type");
  CREATE INDEX "content_events_starts_at_idx" ON "content_events" USING btree ("starts_at");
  CREATE INDEX "content_events_wg_idx" ON "content_events" USING btree ("wg_id");
  CREATE INDEX "content_events_updated_at_idx" ON "content_events" USING btree ("updated_at");
  CREATE INDEX "content_events_created_at_idx" ON "content_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "content_announcements_slug_idx" ON "content_announcements" USING btree ("slug");
  CREATE INDEX "content_announcements_updated_at_idx" ON "content_announcements" USING btree ("updated_at");
  CREATE INDEX "content_announcements_created_at_idx" ON "content_announcements" USING btree ("created_at");
  CREATE UNIQUE INDEX "content_submissions_slug_idx" ON "content_submissions" USING btree ("slug");
  CREATE INDEX "content_submissions_status_idx" ON "content_submissions" USING btree ("status");
  CREATE INDEX "content_submissions_deadline_at_idx" ON "content_submissions" USING btree ("deadline_at");
  CREATE INDEX "content_submissions_wg_idx" ON "content_submissions" USING btree ("wg_id");
  CREATE INDEX "content_submissions_updated_at_idx" ON "content_submissions" USING btree ("updated_at");
  CREATE INDEX "content_submissions_created_at_idx" ON "content_submissions" USING btree ("created_at");
  CREATE UNIQUE INDEX "council_decisions_slug_idx" ON "council_decisions" USING btree ("slug");
  CREATE INDEX "council_decisions_status_idx" ON "council_decisions" USING btree ("status");
  CREATE INDEX "council_decisions_updated_at_idx" ON "council_decisions" USING btree ("updated_at");
  CREATE INDEX "council_decisions_created_at_idx" ON "council_decisions" USING btree ("created_at");
  CREATE UNIQUE INDEX "content_coys_slug_idx" ON "content_coys" USING btree ("slug");
  CREATE INDEX "content_coys_type_idx" ON "content_coys" USING btree ("type");
  CREATE INDEX "content_coys_region_idx" ON "content_coys" USING btree ("region");
  CREATE INDEX "content_coys_status_idx" ON "content_coys" USING btree ("status");
  CREATE INDEX "content_coys_review_status_idx" ON "content_coys" USING btree ("review_status");
  CREATE INDEX "content_coys_updated_at_idx" ON "content_coys" USING btree ("updated_at");
  CREATE INDEX "content_coys_created_at_idx" ON "content_coys" USING btree ("created_at");
  CREATE INDEX "directory_contacts_group_idx" ON "directory_contacts" USING btree ("group");
  CREATE INDEX "directory_contacts_wg_idx" ON "directory_contacts" USING btree ("wg_id");
  CREATE INDEX "directory_contacts_updated_at_idx" ON "directory_contacts" USING btree ("updated_at");
  CREATE INDEX "directory_contacts_created_at_idx" ON "directory_contacts" USING btree ("created_at");
  CREATE UNIQUE INDEX "catalogue_resources_slug_idx" ON "catalogue_resources" USING btree ("slug");
  CREATE INDEX "catalogue_resources_pathway_idx" ON "catalogue_resources" USING btree ("pathway");
  CREATE INDEX "catalogue_resources_type_idx" ON "catalogue_resources" USING btree ("type");
  CREATE INDEX "catalogue_resources_verification_status_idx" ON "catalogue_resources" USING btree ("verification_status");
  CREATE INDEX "catalogue_resources_updated_at_idx" ON "catalogue_resources" USING btree ("updated_at");
  CREATE INDEX "catalogue_resources_created_at_idx" ON "catalogue_resources" USING btree ("created_at");
  CREATE UNIQUE INDEX "opportunities_slug_idx" ON "opportunities" USING btree ("slug");
  CREATE INDEX "opportunities_kind_idx" ON "opportunities" USING btree ("kind");
  CREATE INDEX "opportunities_format_idx" ON "opportunities" USING btree ("format");
  CREATE INDEX "opportunities_deadline_at_idx" ON "opportunities" USING btree ("deadline_at");
  CREATE INDEX "opportunities_org_account_idx" ON "opportunities" USING btree ("org_account_id");
  CREATE INDEX "opportunities_status_idx" ON "opportunities" USING btree ("status");
  CREATE INDEX "opportunities_updated_at_idx" ON "opportunities" USING btree ("updated_at");
  CREATE INDEX "opportunities_created_at_idx" ON "opportunities" USING btree ("created_at");
  CREATE INDEX "feedback_tickets_account_idx" ON "feedback_tickets" USING btree ("account_id");
  CREATE INDEX "feedback_tickets_status_idx" ON "feedback_tickets" USING btree ("status");
  CREATE INDEX "feedback_tickets_updated_at_idx" ON "feedback_tickets" USING btree ("updated_at");
  CREATE INDEX "feedback_tickets_created_at_idx" ON "feedback_tickets" USING btree ("created_at");
  CREATE UNIQUE INDEX "gys_cycles_year_idx" ON "gys_cycles" USING btree ("year");
  CREATE INDEX "gys_cycles_is_current_idx" ON "gys_cycles" USING btree ("is_current");
  CREATE INDEX "gys_cycles_updated_at_idx" ON "gys_cycles" USING btree ("updated_at");
  CREATE INDEX "gys_cycles_created_at_idx" ON "gys_cycles" USING btree ("created_at");
  CREATE INDEX "gys_contributions_updated_at_idx" ON "gys_contributions" USING btree ("updated_at");
  CREATE INDEX "gys_contributions_created_at_idx" ON "gys_contributions" USING btree ("created_at");
  CREATE UNIQUE INDEX "gys_workflow_cycles_code_idx" ON "gys_workflow_cycles" USING btree ("code");
  CREATE INDEX "gys_workflow_cycles_status_idx" ON "gys_workflow_cycles" USING btree ("status");
  CREATE INDEX "gys_workflow_cycles_updated_at_idx" ON "gys_workflow_cycles" USING btree ("updated_at");
  CREATE INDEX "gys_workflow_cycles_created_at_idx" ON "gys_workflow_cycles" USING btree ("created_at");
  CREATE INDEX "gys_tracked_contributions_cycle_idx" ON "gys_tracked_contributions" USING btree ("cycle_id");
  CREATE INDEX "gys_tracked_contributions_author_idx" ON "gys_tracked_contributions" USING btree ("author_id");
  CREATE INDEX "gys_tracked_contributions_reviewer_idx" ON "gys_tracked_contributions" USING btree ("reviewer_id");
  CREATE INDEX "gys_tracked_contributions_status_idx" ON "gys_tracked_contributions" USING btree ("status");
  CREATE INDEX "gys_tracked_contributions_updated_at_idx" ON "gys_tracked_contributions" USING btree ("updated_at");
  CREATE INDEX "gys_tracked_contributions_created_at_idx" ON "gys_tracked_contributions" USING btree ("created_at");
  CREATE INDEX "wg_activities_wg_idx" ON "wg_activities" USING btree ("wg_id");
  CREATE INDEX "wg_activities_posted_by_idx" ON "wg_activities" USING btree ("posted_by_id");
  CREATE INDEX "wg_activities_updated_at_idx" ON "wg_activities" USING btree ("updated_at");
  CREATE INDEX "wg_activities_created_at_idx" ON "wg_activities" USING btree ("created_at");
  CREATE INDEX "cp_call_slots_host_account_idx" ON "cp_call_slots" USING btree ("host_account_id");
  CREATE INDEX "cp_call_slots_starts_at_idx" ON "cp_call_slots" USING btree ("starts_at");
  CREATE INDEX "cp_call_slots_status_idx" ON "cp_call_slots" USING btree ("status");
  CREATE INDEX "cp_call_slots_booked_by_account_idx" ON "cp_call_slots" USING btree ("booked_by_account_id");
  CREATE INDEX "cp_call_slots_updated_at_idx" ON "cp_call_slots" USING btree ("updated_at");
  CREATE INDEX "cp_call_slots_created_at_idx" ON "cp_call_slots" USING btree ("created_at");
  CREATE INDEX "content_drafts_content_type_idx" ON "content_drafts" USING btree ("content_type");
  CREATE INDEX "content_drafts_content_key_idx" ON "content_drafts" USING btree ("content_key");
  CREATE INDEX "content_drafts_status_idx" ON "content_drafts" USING btree ("status");
  CREATE INDEX "content_drafts_author_idx" ON "content_drafts" USING btree ("author_id");
  CREATE INDEX "content_drafts_reviewer_idx" ON "content_drafts" USING btree ("reviewer_id");
  CREATE INDEX "content_drafts_updated_at_idx" ON "content_drafts" USING btree ("updated_at");
  CREATE INDEX "content_drafts_created_at_idx" ON "content_drafts" USING btree ("created_at");
  CREATE INDEX "consultation_contributions_kind_idx" ON "consultation_contributions" USING btree ("kind");
  CREATE INDEX "consultation_contributions_updated_at_idx" ON "consultation_contributions" USING btree ("updated_at");
  CREATE INDEX "consultation_contributions_created_at_idx" ON "consultation_contributions" USING btree ("created_at");
  CREATE INDEX "password_resets_account_idx" ON "password_resets" USING btree ("account_id");
  CREATE INDEX "password_resets_token_hash_idx" ON "password_resets" USING btree ("token_hash");
  CREATE INDEX "password_resets_updated_at_idx" ON "password_resets" USING btree ("updated_at");
  CREATE INDEX "password_resets_created_at_idx" ON "password_resets" USING btree ("created_at");
  CREATE INDEX "ngo_seats_org_account_idx" ON "ngo_seats" USING btree ("org_account_id");
  CREATE INDEX "ngo_seats_member_account_idx" ON "ngo_seats" USING btree ("member_account_id");
  CREATE INDEX "ngo_seats_email_idx" ON "ngo_seats" USING btree ("email");
  CREATE INDEX "ngo_seats_status_idx" ON "ngo_seats" USING btree ("status");
  CREATE INDEX "ngo_seats_invited_by_idx" ON "ngo_seats" USING btree ("invited_by_id");
  CREATE INDEX "ngo_seats_updated_at_idx" ON "ngo_seats" USING btree ("updated_at");
  CREATE INDEX "ngo_seats_created_at_idx" ON "ngo_seats" USING btree ("created_at");
  CREATE INDEX "ngo_requests_org_account_idx" ON "ngo_requests" USING btree ("org_account_id");
  CREATE INDEX "ngo_requests_status_idx" ON "ngo_requests" USING btree ("status");
  CREATE INDEX "ngo_requests_decided_by_idx" ON "ngo_requests" USING btree ("decided_by_id");
  CREATE INDEX "ngo_requests_updated_at_idx" ON "ngo_requests" USING btree ("updated_at");
  CREATE INDEX "ngo_requests_created_at_idx" ON "ngo_requests" USING btree ("created_at");
  CREATE INDEX "membership_appeals_account_idx" ON "membership_appeals" USING btree ("account_id");
  CREATE INDEX "membership_appeals_proof_idx" ON "membership_appeals" USING btree ("proof_id");
  CREATE INDEX "membership_appeals_status_idx" ON "membership_appeals" USING btree ("status");
  CREATE INDEX "membership_appeals_reviewed_by_idx" ON "membership_appeals" USING btree ("reviewed_by_id");
  CREATE INDEX "membership_appeals_updated_at_idx" ON "membership_appeals" USING btree ("updated_at");
  CREATE INDEX "membership_appeals_created_at_idx" ON "membership_appeals" USING btree ("created_at");
  CREATE UNIQUE INDEX "notification_prefs_account_idx" ON "notification_prefs" USING btree ("account_id");
  CREATE INDEX "notification_prefs_updated_at_idx" ON "notification_prefs" USING btree ("updated_at");
  CREATE INDEX "notification_prefs_created_at_idx" ON "notification_prefs" USING btree ("created_at");
  CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");
  CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");
  CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
  CREATE INDEX "push_subscriptions_account_idx" ON "push_subscriptions" USING btree ("account_id");
  CREATE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
  CREATE INDEX "push_subscriptions_updated_at_idx" ON "push_subscriptions" USING btree ("updated_at");
  CREATE INDEX "push_subscriptions_created_at_idx" ON "push_subscriptions" USING btree ("created_at");
  CREATE INDEX "resource_issues_resource_slug_idx" ON "resource_issues" USING btree ("resource_slug");
  CREATE INDEX "resource_issues_reported_by_idx" ON "resource_issues" USING btree ("reported_by_id");
  CREATE INDEX "resource_issues_resolved_by_idx" ON "resource_issues" USING btree ("resolved_by_id");
  CREATE INDEX "resource_issues_updated_at_idx" ON "resource_issues" USING btree ("updated_at");
  CREATE INDEX "resource_issues_created_at_idx" ON "resource_issues" USING btree ("created_at");
  CREATE INDEX "resource_reviews_resource_slug_idx" ON "resource_reviews" USING btree ("resource_slug");
  CREATE INDEX "resource_reviews_reviewed_by_idx" ON "resource_reviews" USING btree ("reviewed_by_id");
  CREATE INDEX "resource_reviews_updated_at_idx" ON "resource_reviews" USING btree ("updated_at");
  CREATE INDEX "resource_reviews_created_at_idx" ON "resource_reviews" USING btree ("created_at");
  CREATE INDEX "research_notes_account_idx" ON "research_notes" USING btree ("account_id");
  CREATE INDEX "research_notes_kind_idx" ON "research_notes" USING btree ("kind");
  CREATE INDEX "research_notes_status_idx" ON "research_notes" USING btree ("status");
  CREATE INDEX "research_notes_idempotency_key_idx" ON "research_notes" USING btree ("idempotency_key");
  CREATE INDEX "research_notes_approved_by_idx" ON "research_notes" USING btree ("approved_by_id");
  CREATE INDEX "research_notes_applied_by_idx" ON "research_notes" USING btree ("applied_by_id");
  CREATE INDEX "research_notes_updated_at_idx" ON "research_notes" USING btree ("updated_at");
  CREATE INDEX "research_notes_created_at_idx" ON "research_notes" USING btree ("created_at");
  CREATE INDEX "email_verification_tokens_account_idx" ON "email_verification_tokens" USING btree ("account_id");
  CREATE INDEX "email_verification_tokens_token_hash_idx" ON "email_verification_tokens" USING btree ("token_hash");
  CREATE INDEX "email_verification_tokens_updated_at_idx" ON "email_verification_tokens" USING btree ("updated_at");
  CREATE INDEX "email_verification_tokens_created_at_idx" ON "email_verification_tokens" USING btree ("created_at");
  CREATE UNIQUE INDEX "negotiation_tracks_slug_idx" ON "negotiation_tracks" USING btree ("slug");
  CREATE INDEX "negotiation_tracks_activity_status_idx" ON "negotiation_tracks" USING btree ("activity_status");
  CREATE INDEX "negotiation_tracks_published_idx" ON "negotiation_tracks" USING btree ("published");
  CREATE INDEX "negotiation_tracks_updated_at_idx" ON "negotiation_tracks" USING btree ("updated_at");
  CREATE INDEX "negotiation_tracks_created_at_idx" ON "negotiation_tracks" USING btree ("created_at");
  CREATE INDEX "negotiation_projects_track_slug_idx" ON "negotiation_projects" USING btree ("track_slug");
  CREATE INDEX "negotiation_projects_status_idx" ON "negotiation_projects" USING btree ("status");
  CREATE INDEX "negotiation_projects_created_by_idx" ON "negotiation_projects" USING btree ("created_by_id");
  CREATE INDEX "negotiation_projects_updated_at_idx" ON "negotiation_projects" USING btree ("updated_at");
  CREATE INDEX "negotiation_projects_created_at_idx" ON "negotiation_projects" USING btree ("created_at");
  CREATE INDEX "negotiation_follows_account_idx" ON "negotiation_follows" USING btree ("account_id");
  CREATE INDEX "negotiation_follows_track_slug_idx" ON "negotiation_follows" USING btree ("track_slug");
  CREATE INDEX "negotiation_follows_updated_at_idx" ON "negotiation_follows" USING btree ("updated_at");
  CREATE INDEX "negotiation_follows_created_at_idx" ON "negotiation_follows" USING btree ("created_at");
  CREATE INDEX "negotiation_amendments_track_slug_idx" ON "negotiation_amendments" USING btree ("track_slug");
  CREATE INDEX "negotiation_amendments_submitted_by_idx" ON "negotiation_amendments" USING btree ("submitted_by_id");
  CREATE INDEX "negotiation_amendments_updated_at_idx" ON "negotiation_amendments" USING btree ("updated_at");
  CREATE INDEX "negotiation_amendments_created_at_idx" ON "negotiation_amendments" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("accounts_id");
  CREATE INDEX "payload_locked_documents_rels_assignments_id_idx" ON "payload_locked_documents_rels" USING btree ("assignments_id");
  CREATE INDEX "payload_locked_documents_rels_member_profiles_id_idx" ON "payload_locked_documents_rels" USING btree ("member_profiles_id");
  CREATE INDEX "payload_locked_documents_rels_working_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("working_groups_id");
  CREATE INDEX "payload_locked_documents_rels_wg_progress_id_idx" ON "payload_locked_documents_rels" USING btree ("wg_progress_id");
  CREATE INDEX "payload_locked_documents_rels_content_events_id_idx" ON "payload_locked_documents_rels" USING btree ("content_events_id");
  CREATE INDEX "payload_locked_documents_rels_content_announcements_id_idx" ON "payload_locked_documents_rels" USING btree ("content_announcements_id");
  CREATE INDEX "payload_locked_documents_rels_content_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("content_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_council_decisions_id_idx" ON "payload_locked_documents_rels" USING btree ("council_decisions_id");
  CREATE INDEX "payload_locked_documents_rels_content_coys_id_idx" ON "payload_locked_documents_rels" USING btree ("content_coys_id");
  CREATE INDEX "payload_locked_documents_rels_directory_contacts_id_idx" ON "payload_locked_documents_rels" USING btree ("directory_contacts_id");
  CREATE INDEX "payload_locked_documents_rels_catalogue_resources_id_idx" ON "payload_locked_documents_rels" USING btree ("catalogue_resources_id");
  CREATE INDEX "payload_locked_documents_rels_opportunities_id_idx" ON "payload_locked_documents_rels" USING btree ("opportunities_id");
  CREATE INDEX "payload_locked_documents_rels_feedback_tickets_id_idx" ON "payload_locked_documents_rels" USING btree ("feedback_tickets_id");
  CREATE INDEX "payload_locked_documents_rels_gys_cycles_id_idx" ON "payload_locked_documents_rels" USING btree ("gys_cycles_id");
  CREATE INDEX "payload_locked_documents_rels_gys_contributions_id_idx" ON "payload_locked_documents_rels" USING btree ("gys_contributions_id");
  CREATE INDEX "payload_locked_documents_rels_gys_workflow_cycles_id_idx" ON "payload_locked_documents_rels" USING btree ("gys_workflow_cycles_id");
  CREATE INDEX "payload_locked_documents_rels_gys_tracked_contributions__idx" ON "payload_locked_documents_rels" USING btree ("gys_tracked_contributions_id");
  CREATE INDEX "payload_locked_documents_rels_wg_activities_id_idx" ON "payload_locked_documents_rels" USING btree ("wg_activities_id");
  CREATE INDEX "payload_locked_documents_rels_cp_call_slots_id_idx" ON "payload_locked_documents_rels" USING btree ("cp_call_slots_id");
  CREATE INDEX "payload_locked_documents_rels_content_drafts_id_idx" ON "payload_locked_documents_rels" USING btree ("content_drafts_id");
  CREATE INDEX "payload_locked_documents_rels_consultation_contributions_idx" ON "payload_locked_documents_rels" USING btree ("consultation_contributions_id");
  CREATE INDEX "payload_locked_documents_rels_password_resets_id_idx" ON "payload_locked_documents_rels" USING btree ("password_resets_id");
  CREATE INDEX "payload_locked_documents_rels_ngo_seats_id_idx" ON "payload_locked_documents_rels" USING btree ("ngo_seats_id");
  CREATE INDEX "payload_locked_documents_rels_ngo_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("ngo_requests_id");
  CREATE INDEX "payload_locked_documents_rels_membership_appeals_id_idx" ON "payload_locked_documents_rels" USING btree ("membership_appeals_id");
  CREATE INDEX "payload_locked_documents_rels_notification_prefs_id_idx" ON "payload_locked_documents_rels" USING btree ("notification_prefs_id");
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");
  CREATE INDEX "payload_locked_documents_rels_push_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("push_subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_resource_issues_id_idx" ON "payload_locked_documents_rels" USING btree ("resource_issues_id");
  CREATE INDEX "payload_locked_documents_rels_resource_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("resource_reviews_id");
  CREATE INDEX "payload_locked_documents_rels_research_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("research_notes_id");
  CREATE INDEX "payload_locked_documents_rels_email_verification_tokens__idx" ON "payload_locked_documents_rels" USING btree ("email_verification_tokens_id");
  CREATE INDEX "payload_locked_documents_rels_negotiation_tracks_id_idx" ON "payload_locked_documents_rels" USING btree ("negotiation_tracks_id");
  CREATE INDEX "payload_locked_documents_rels_negotiation_projects_id_idx" ON "payload_locked_documents_rels" USING btree ("negotiation_projects_id");
  CREATE INDEX "payload_locked_documents_rels_negotiation_follows_id_idx" ON "payload_locked_documents_rels" USING btree ("negotiation_follows_id");
  CREATE INDEX "payload_locked_documents_rels_negotiation_amendments_id_idx" ON "payload_locked_documents_rels" USING btree ("negotiation_amendments_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_rels_accounts_id_idx" ON "payload_preferences_rels" USING btree ("accounts_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  -- Operational platform (decision-making): tables the platform service manages
  -- directly, ported from legacy migration 034_operational_platform.sql with
  -- account references adapted to accounts(id) serial.
  CREATE UNIQUE INDEX "assignments_scope_unique" ON "assignments" USING btree ("account_id","scope_type","scope_id","role");

  CREATE TABLE "platform_bodies" (
    "id" varchar PRIMARY KEY,
    "name" varchar NOT NULL,
    "kind" varchar NOT NULL,
    "description" varchar DEFAULT '' NOT NULL,
    "public_summary" varchar DEFAULT '' NOT NULL,
    "review_due_at" timestamp(3) with time zone,
    "version" numeric DEFAULT 1 NOT NULL,
    "updated_by" integer REFERENCES "public"."accounts"("id") ON DELETE set null,
    "public_snapshot" jsonb,
    "published_version" numeric,
    "published_by" integer REFERENCES "public"."accounts"("id") ON DELETE set null,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "platform_decisions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "body_id" varchar NOT NULL REFERENCES "public"."platform_bodies"("id"),
    "title" varchar NOT NULL,
    "proposal" varchar NOT NULL,
    "stage" varchar DEFAULT 'draft' NOT NULL,
    "process" varchar NOT NULL,
    "snap_hours" numeric DEFAULT 24 NOT NULL,
    "urgency_reason" varchar DEFAULT '' NOT NULL,
    "policy_version" varchar NOT NULL,
    "deadline_at" timestamp(3) with time zone,
    "version" numeric DEFAULT 1 NOT NULL,
    "author_id" integer NOT NULL REFERENCES "public"."accounts"("id"),
    "is_public" boolean DEFAULT false NOT NULL,
    "outcome" varchar,
    "outcome_evidence" varchar,
    "electorate_size" numeric,
    "votes_for" numeric,
    "votes_against" numeric,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX "platform_decisions_body" ON "platform_decisions" USING btree ("body_id","stage");

  CREATE TABLE "platform_decision_revisions" (
    "decision_id" uuid NOT NULL REFERENCES "public"."platform_decisions"("id"),
    "version" numeric NOT NULL,
    "title" varchar NOT NULL,
    "proposal" varchar NOT NULL,
    "author_id" integer NOT NULL REFERENCES "public"."accounts"("id"),
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY("decision_id","version")
  );

  CREATE TABLE "platform_contributions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "decision_id" uuid NOT NULL REFERENCES "public"."platform_decisions"("id"),
    "author_id" integer NOT NULL REFERENCES "public"."accounts"("id"),
    "kind" varchar NOT NULL,
    "text" varchar NOT NULL,
    "grounds" varchar DEFAULT '' NOT NULL,
    "alternative" varchar DEFAULT '' NOT NULL,
    "resolution" varchar,
    "resolved_by" integer REFERENCES "public"."accounts"("id") ON DELETE set null,
    "resolved_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "platform_tasks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "body_id" varchar NOT NULL REFERENCES "public"."platform_bodies"("id"),
    "title" varchar NOT NULL,
    "description" varchar DEFAULT '' NOT NULL,
    "owner_id" integer REFERENCES "public"."accounts"("id") ON DELETE set null,
    "due_at" timestamp(3) with time zone,
    "status" varchar DEFAULT 'open' NOT NULL,
    "decision_id" uuid REFERENCES "public"."platform_decisions"("id"),
    "version" numeric DEFAULT 1 NOT NULL,
    "created_by" integer NOT NULL REFERENCES "public"."accounts"("id"),
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX "platform_tasks_due" ON "platform_tasks" USING btree ("due_at");

  CREATE TABLE "platform_enquiries" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organisation" varchar NOT NULL,
    "contact_name" varchar NOT NULL,
    "email" varchar NOT NULL,
    "message" varchar NOT NULL,
    "consent_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "privacy_version" varchar NOT NULL,
    "status" varchar DEFAULT 'new' NOT NULL,
    "owner_id" integer REFERENCES "public"."accounts"("id") ON DELETE set null,
    "follow_up_at" timestamp(3) with time zone,
    "decision_id" uuid REFERENCES "public"."platform_decisions"("id"),
    "public_summary" varchar DEFAULT '' NOT NULL,
    "website" varchar DEFAULT '' NOT NULL,
    "version" numeric DEFAULT 1 NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "accounts_sessions" CASCADE;
  DROP TABLE "accounts" CASCADE;
  DROP TABLE "assignments" CASCADE;
  DROP TABLE "member_profiles" CASCADE;
  DROP TABLE "working_groups_tags" CASCADE;
  DROP TABLE "working_groups_resources" CASCADE;
  DROP TABLE "working_groups" CASCADE;
  DROP TABLE "wg_progress" CASCADE;
  DROP TABLE "content_events" CASCADE;
  DROP TABLE "content_announcements" CASCADE;
  DROP TABLE "content_submissions" CASCADE;
  DROP TABLE "council_decisions" CASCADE;
  DROP TABLE "content_coys" CASCADE;
  DROP TABLE "directory_contacts" CASCADE;
  DROP TABLE "catalogue_resources" CASCADE;
  DROP TABLE "opportunities" CASCADE;
  DROP TABLE "feedback_tickets" CASCADE;
  DROP TABLE "gys_cycles" CASCADE;
  DROP TABLE "gys_contributions" CASCADE;
  DROP TABLE "gys_workflow_cycles" CASCADE;
  DROP TABLE "gys_tracked_contributions" CASCADE;
  DROP TABLE "wg_activities" CASCADE;
  DROP TABLE "cp_call_slots" CASCADE;
  DROP TABLE "content_drafts" CASCADE;
  DROP TABLE "consultation_contributions" CASCADE;
  DROP TABLE "password_resets" CASCADE;
  DROP TABLE "ngo_seats" CASCADE;
  DROP TABLE "ngo_requests" CASCADE;
  DROP TABLE "membership_appeals" CASCADE;
  DROP TABLE "notification_prefs" CASCADE;
  DROP TABLE "audit_log" CASCADE;
  DROP TABLE "push_subscriptions" CASCADE;
  DROP TABLE "resource_issues" CASCADE;
  DROP TABLE "resource_reviews" CASCADE;
  DROP TABLE "research_notes" CASCADE;
  DROP TABLE "email_verification_tokens" CASCADE;
  DROP TABLE "negotiation_tracks" CASCADE;
  DROP TABLE "negotiation_projects" CASCADE;
  DROP TABLE "negotiation_follows" CASCADE;
  DROP TABLE "negotiation_amendments" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_accounts_entity_type";
  DROP TYPE "public"."enum_accounts_membership_track";
  DROP TYPE "public"."enum_accounts_member_status";
  DROP TYPE "public"."enum_accounts_hub_access_status";
  DROP TYPE "public"."enum_accounts_membership_status";
  DROP TYPE "public"."enum_accounts_constituency_work_status";
  DROP TYPE "public"."enum_accounts_role";
  DROP TYPE "public"."enum_assignments_scope_type";
  DROP TYPE "public"."enum_assignments_status";
  DROP TYPE "public"."enum_member_profiles_directory_visibility";
  DROP TYPE "public"."enum_wg_progress_status";
  DROP TYPE "public"."enum_wg_progress_role_in_wg";
  DROP TYPE "public"."enum_content_submissions_status";
  DROP TYPE "public"."enum_council_decisions_status";
  DROP TYPE "public"."enum_content_coys_type";
  DROP TYPE "public"."enum_content_coys_review_status";
  DROP TYPE "public"."enum_catalogue_resources_verification_status";
  DROP TYPE "public"."enum_opportunities_kind";
  DROP TYPE "public"."enum_opportunities_format";
  DROP TYPE "public"."enum_opportunities_status";
  DROP TYPE "public"."enum_feedback_tickets_kind";
  DROP TYPE "public"."enum_feedback_tickets_severity";
  DROP TYPE "public"."enum_feedback_tickets_status";
  DROP TYPE "public"."enum_gys_workflow_cycles_status";
  DROP TYPE "public"."enum_gys_tracked_contributions_status";
  DROP TYPE "public"."enum_cp_call_slots_status";
  DROP TYPE "public"."enum_content_drafts_content_type";
  DROP TYPE "public"."enum_content_drafts_status";
  DROP TYPE "public"."enum_ngo_seats_seat_role";
  DROP TYPE "public"."enum_ngo_seats_status";
  DROP TYPE "public"."enum_ngo_requests_status";
  DROP TYPE "public"."enum_membership_appeals_status";
  DROP TYPE "public"."enum_resource_issues_kind";
  DROP TYPE "public"."enum_resource_reviews_status";
  DROP TYPE "public"."enum_research_notes_kind";
  DROP TYPE "public"."enum_research_notes_status";
  DROP TABLE "platform_enquiries" CASCADE;
  DROP TABLE "platform_tasks" CASCADE;
  DROP TABLE "platform_contributions" CASCADE;
  DROP TABLE "platform_decision_revisions" CASCADE;
  DROP TABLE "platform_decisions" CASCADE;
  DROP TABLE "platform_bodies" CASCADE;
`)
}
