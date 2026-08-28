# Fillthemat product brief

Founder prompt captured for V1 planning. This is product intent, not the implementation spec. Implementation decisions live in `docs/v1-plan.md`.

## What it is

Fillthemat is an AI-powered growth platform for martial arts schools that converts leads into trial classes, follow up automatically, and helps convert them into paying members.

## Who it is for

The ICP is the owner of a martial arts school. They have existing clients and an operation, but they struggle to get new people in the door each day to book trials. They lack pipeline. Fillthemat helps that problem by improving their online marketing process.

## Marketing pipeline we sit in

1. ICP creates Digital Content (DC).
2. ICP uploads the DC to Social Platforms (SP) for distribution, commonly with Paid Ads (PA) to enhance distribution.
3. A Prospect (P) views the DC via the PA on their SP.
4. They may click the PA, which takes them to an external URL — a Landing Page (LP).
5. The goal of the LP is to book the Prospect a timeslot for their first trial class.
6. From there, converting the trial into a paying member is the school's responsibility.
7. From the LP's point of view, the job is done once the Prospect books a trial class, through whatever services were provided through the LP.

## What we are building

The LP, which will look like a branded AI chat-agent that specializes in understanding new Prospects and helping them book their trial class.

## Owner (ICP) product

A basic flow to register new ICPs. They have an admin dashboard to configure the dependencies for the LP. Examples: URL, branding, chat-agent behaviour, academy name, location, website, parking, access instructions, schedule, trial information (when, what to wear, waiver requirements, how to arrive early), memberships and pricing, FAQs, etc.

The platform should allow the ICP to configure engagement post-trial-booking: GCal invites, follow-up emails sometime before their class, etc.

When a class is considered booked, the dashboard has a view of booked-trial data, and the owner can update it to Showed vs Not showed.

- If Showed: help start a post-trial conversion sequence (TBD).
- If Not showed: TBD workflows can be continued.

## Prospect product

Once a basic platform setup has been configured, the Prospect should be able to have a good conversation with the chat agent that reflects the desires of the ICP. It should help them book that trial class, then they should get reminders and engagement before the class so the process is smooth.
