"""
Seed script: inserts realistic sample feedback data into Supabase.
Uses the service-role key so it bypasses RLS.
Run once: python seed_feedback.py
"""
import os, sys, uuid, random
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")

try:
    from supabase import create_client, Client
except ImportError:
    print("Installing supabase-py…")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "supabase", "python-dotenv", "-q"])
    from supabase import create_client, Client

SUPABASE_URL   = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_KEY    = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

sb: Client = create_client(SUPABASE_URL, SERVICE_KEY)

# ── 1. Discover the org ──────────────────────────────────────────────────────
orgs = sb.table("organizations").select("id, name").execute().data
if not orgs:
    print("❌  No organizations found. Please sign up and create an org first, then re-run.")
    sys.exit(1)

org = orgs[0]
ORG_ID = org["id"]
print(f"✅  Using org: {org['name']} ({ORG_ID})")

# ── 2. Ensure channels exist ─────────────────────────────────────────────────
CHANNEL_NAMES = ["App Store", "Support Tickets", "Twitter/X", "G2 Review", "NPS Survey", "In-App Widget"]

existing_channels = {r["name"]: r["id"] for r in
    sb.table("channels").select("id, name").eq("org_id", ORG_ID).execute().data}

for name in CHANNEL_NAMES:
    if name not in existing_channels:
        row = sb.table("channels").insert({"org_id": ORG_ID, "name": name}).execute().data[0]
        existing_channels[name] = row["id"]
        print(f"   Created channel: {name}")

print(f"✅  Channels ready: {list(existing_channels.keys())}")

# ── 3. Seed customers ────────────────────────────────────────────────────────
CUSTOMERS = [
    {"name": "Alice Nguyen",    "email": "alice@techcorp.io",    "company": "TechCorp"},
    {"name": "Bob Martinez",    "email": "bob@startup.ai",       "company": "StartupAI"},
    {"name": "Carol Smith",     "email": "carol@enterprise.com", "company": "EnterpriseGmbH"},
    {"name": "David Lee",       "email": "david@fintech.co",     "company": "FintechCo"},
    {"name": "Emma Wilson",     "email": "emma@saas.io",         "company": "SaaSFlow"},
    {"name": "Frank Johnson",   "email": "frank@cloudops.net",   "company": "CloudOps"},
    {"name": "Grace Chen",      "email": "grace@datadriven.co",  "company": "DataDriven"},
    {"name": "Henry Patel",     "email": "henry@b2b.com",        "company": "B2BSolutions"},
    {"name": "Isabel Torres",   "email": "isabel@ecomm.io",      "company": "EcommCo"},
    {"name": "James Kim",       "email": "james@analytics.ai",   "company": "AnalyticsAI"},
]

existing_customers = {r["email"]: r["id"] for r in
    sb.table("customers").select("id, email").eq("org_id", ORG_ID).execute().data
    if r["email"]}

customer_ids = []
for c in CUSTOMERS:
    if c["email"] not in existing_customers:
        row = sb.table("customers").insert({
            "org_id": ORG_ID, "name": c["name"],
            "email": c["email"], "company": c["company"]
        }).execute().data[0]
        existing_customers[c["email"]] = row["id"]
    customer_ids.append(existing_customers[c["email"]])

print(f"✅  Customers ready: {len(customer_ids)}")

# ── 4. Seed feedback items ────────────────────────────────────────────────────
FEEDBACK_SAMPLES = [
    # negative / pain points
    ("App Store",        "negative",    "The dashboard takes forever to load. We have ~10k feedback entries and it just spins. Unusable at this scale."),
    ("Support Tickets",  "very_negative","We lost 3 days of data after the latest update. No warning, no rollback option. This is a serious reliability issue."),
    ("Twitter/X",        "negative",    "Why does the CSV import silently drop rows with special characters? Took me hours to figure out. Terrible UX."),
    ("G2 Review",        "negative",    "Sentiment analysis is wildly inaccurate for our industry. Flags perfectly normal medical terminology as 'negative'."),
    ("Support Tickets",  "negative",    "The Slack integration broke after the v2.3 release and support has been unresponsive for 6 days now."),
    ("In-App Widget",    "negative",    "No bulk delete option. I have to delete 500 entries one by one. This is a deal-breaker for our team."),
    ("NPS Survey",       "negative",    "Pricing jumped 40% with no notice. We're evaluating alternatives. The new tier limits are unreasonable."),
    ("App Store",        "negative",    "Crashes constantly on iOS 17. I've submitted 3 bug reports with no response. 1 star until fixed."),
    ("Support Tickets",  "negative",    "The API rate limits are too aggressive. We're getting 429s on basic read operations during peak hours."),
    ("Twitter/X",        "negative",    "Exporting to Excel produces corrupted files half the time. How is this still not fixed after 2 months?"),
    # neutral
    ("NPS Survey",       "neutral",     "It does what it says. Nothing groundbreaking but reliable enough for our use case. Would be great to have Jira integration."),
    ("G2 Review",        "neutral",     "Average product. The onboarding was confusing but once you get past that it's workable. Documentation needs improvement."),
    ("In-App Widget",    "neutral",     "Switched from Medallia. Feature parity is roughly the same. Pricing is better. Migration took longer than expected."),
    ("App Store",        "neutral",     "Works fine for small teams. Once you scale up, performance degrades noticeably. Waiting to see if they fix it."),
    ("Support Tickets",  "neutral",     "The product is OK but the mobile app feels like an afterthought. Web is much better. Need full parity."),
    # positive
    ("G2 Review",        "positive",    "LangGraph-powered analysis is genuinely impressive. Surfaced a pain point cluster we'd completely missed. 4 stars."),
    ("NPS Survey",       "positive",    "Our NPS score improved by 18 points after acting on VoiceIQ insights. The ROI case is easy to make now."),
    ("App Store",        "positive",    "The AI chat feature saved our PM team hours every week. Instead of reading 500 tickets, we just ask a question."),
    ("In-App Widget",    "positive",    "Onboarding was smooth and the support team was super responsive. We were up and running in under a day."),
    ("Twitter/X",        "positive",    "Love the real-time sentiment dashboard. It's the first thing I check every morning. Helps prioritize the roadmap instantly."),
    ("G2 Review",        "very_positive","Best customer intelligence tool we've used. The theme clustering is magic — it groups feedback we never would have connected."),
    ("NPS Survey",       "very_positive","Replaced three separate tools with VoiceIQ. Cleaner workflow, better insights, and the team actually uses it now."),
    ("App Store",        "positive",    "The weekly digest email is fantastic. Keeps the whole company aligned on what customers care about."),
    ("Support Tickets",  "positive",    "Bug turnaround time has improved a lot. Filed a critical issue on Monday, had a fix by Wednesday. Impressed."),
    ("In-App Widget",    "positive",    "Finally, a tool that connects NPS scores to specific feature requests. Our product decisions are much more data-driven."),
    # feature requests mixed in
    ("G2 Review",        "neutral",     "Really need a Salesforce integration. We're manually copying data between systems which defeats the purpose."),
    ("NPS Survey",       "positive",    "Would love webhook support so we can push high-urgency feedback directly into PagerDuty. Otherwise love the product."),
    ("Twitter/X",        "neutral",     "Please add dark mode. It's 2026 and my eyes are begging you. Everything else is great though."),
    ("App Store",        "positive",    "Feature request: let us customize the sentiment thresholds per industry. The defaults don't fit B2B healthcare well."),
    ("Support Tickets",  "neutral",     "Requesting multi-language support. We have customers in 12 countries and English-only analysis misses nuance."),
    # churn risks
    ("G2 Review",        "very_negative","We're cancelling after 3 months. Promised features haven't shipped, performance is getting worse, not better."),
    ("NPS Survey",       "negative",    "If the SSO integration isn't ready by Q4 we'll have to switch. Our security team won't approve without it."),
    # delight
    ("In-App Widget",    "very_positive","VoiceIQ's executive summary feature helped me present to the board in 30 minutes instead of 3 hours. Game changer."),
    ("Twitter/X",        "very_positive","The persona clustering feature is incredible. We found a whole segment we didn't know existed. Shaped our entire roadmap."),
    ("App Store",        "very_positive","Customer support is 10/10. Every time I've had an issue it was resolved the same day. Rare in SaaS."),
    # performance
    ("Support Tickets",  "negative",    "Memory usage on the desktop app is insane — 4GB just sitting idle. Slows down my entire machine."),
    ("G2 Review",        "neutral",     "Search is slow and often returns irrelevant results. Would help to have filters by date, sentiment, and channel simultaneously."),
    ("NPS Survey",       "positive",    "The new batch processing for large imports is a huge improvement. Used to time out, now handles 50k rows easily."),
    ("In-App Widget",    "negative",    "Two-factor authentication UI is broken on Firefox. Can't log in without using Chrome which is frustrating."),
    ("Twitter/X",        "positive",    "Competitive benchmarking feature is underrated. Being able to see how your sentiment compares to industry avg is valuable."),
]

now = datetime.now(timezone.utc)
inserted = 0

for (channel_name, sentiment, content) in FEEDBACK_SAMPLES:
    channel_id  = existing_channels[channel_name]
    customer_id = random.choice(customer_ids)
    days_ago    = random.randint(0, 90)
    created_at  = (now - timedelta(days=days_ago)).isoformat()

    sb.table("feedback_items").insert({
        "org_id":      ORG_ID,
        "channel_id":  channel_id,
        "customer_id": customer_id,
        "content":     content,
        "source":      "manual",
        "sentiment":   sentiment,
        "created_at":  created_at,
    }).execute()
    inserted += 1

print(f"\n🎉  Done! Inserted {inserted} feedback items across {len(CHANNEL_NAMES)} channels.")
print("    Open http://localhost:3001 → AI Chat and ask about customer pain points!")
