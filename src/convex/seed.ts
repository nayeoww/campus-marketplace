import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type SeedStudent = {
  name: string;
  email: string;
  branch: string;
  year: string;
  hostel: string;
  bio: string;
};

const STUDENTS: SeedStudent[] = [
  {
    name: "Nayan Verma",
    email: "nayan.verma@ssipmt.com",
    branch: "Computer Science & Engineering",
    year: "3rd year",
    hostel: "Boys Hostel A",
    bio: "Third year CSE. I hoard calculators and upgrade laptops on weekends.",
  },
  {
    name: "Ananya Sahu",
    email: "ananya.sahu@ssipmt.com",
    branch: "Information Technology",
    year: "2nd year",
    hostel: "Girls Hostel",
    bio: "IT, second year. Selling whatever my seniors left behind.",
  },
  {
    name: "Rehan Qureshi",
    email: "rehan.qureshi@ssipmt.com",
    branch: "Electronics & Telecommunication",
    year: "4th year",
    hostel: "Day scholar",
    bio: "Final year ECE. Campus photographer for every fest since 2023.",
  },
  {
    name: "Ipsita Patnaik",
    email: "ipsita.patnaik@ssipmt.com",
    branch: "AI & Data Science",
    year: "3rd year",
    hostel: "Girls Hostel",
    bio: "AI & DS. I write reports, typeset them in LaTeX and never look back.",
  },
  {
    name: "Kartik Yadav",
    email: "kartik.yadav@ssipmt.com",
    branch: "Mechanical Engineering",
    year: "2nd year",
    hostel: "Boys Hostel B",
    bio: "Mechanical, second year. Always lending tools and drawing boards.",
  },
  {
    name: "Shruti Bansal",
    email: "shruti.bansal@ssipmt.com",
    branch: "Management (MBA)",
    year: "1st year",
    hostel: "Day scholar",
    bio: "MBA first year. I run the college social pages on the side.",
  },
  {
    name: "Devansh Mishra",
    email: "devansh.mishra@ssipmt.com",
    branch: "Civil Engineering",
    year: "3rd year",
    hostel: "Boys Hostel A",
    bio: "Civil third year. Survey equipment and site boots, mostly.",
  },
  {
    name: "Tanvi Deshmukh",
    email: "tanvi.deshmukh@ssipmt.com",
    branch: "Electrical Engineering",
    year: "4th year",
    hostel: "Girls Hostel",
    bio: "Electrical, final year. Tutoring first years through M1 and M2.",
  },
];

type SeedListing = {
  student: number;
  kind: "item" | "service";
  title: string;
  category: string;
  description: string;
  price: number;
  priceNote?: string;
  condition?: string;
  location?: string;
  turnaround?: string;
};

const LISTINGS: SeedListing[] = [
  {
    student: 0,
    kind: "item",
    title: "Casio fx-991ES PLUS scientific calculator",
    category: "Calculators",
    description:
      "Used for two semesters of Engineering Mathematics and then put away. All 417 functions work, the slide cover is intact, and I have swapped in a fresh battery this month. Comes with the original cover and a spare cell.",
    price: 650,
    condition: "Good condition",
    location: "Boys Hostel A, room 214",
  },
  {
    student: 1,
    kind: "item",
    title: "Concepts of Physics, Vol 1 & 2 — H. C. Verma",
    category: "Books",
    description:
      "Both volumes, Bharati Bhawan editions. Page edges are clean, no water damage, and only a handful of pencil marks in the mechanics chapters that I can erase before you take them. Ideal for first year.",
    price: 380,
    condition: "Like new",
    location: "Girls Hostel, common room",
  },
  {
    student: 3,
    kind: "item",
    title: "boAt Rockerz 450 wireless headphones",
    category: "Electronics",
    description:
      "Around fourteen months old, battery still lasts close to a full week of lectures. Ear cushions were replaced in July. Charging cable included, box is gone.",
    price: 750,
    condition: "Good condition",
    location: "Library gate",
  },
  {
    student: 4,
    kind: "item",
    title: "Mini drafter with drawing board and clips",
    category: "Other",
    description:
      "Complete set for Engineering Drawing: mini drafter, A2 board, two clips and the carrying sleeve. The drafter's clamp screw was tightened with tape once; it holds perfectly.",
    price: 450,
    condition: "Fair",
    location: "Boys Hostel B, room 108",
  },
  {
    student: 0,
    kind: "item",
    title: "Clamp study lamp, warm white, three brightness levels",
    category: "Hostel",
    description:
      "Clips onto any bunk or table edge and stays put. Runs on the hostel point with a two-pin plug. Selling because I am moving to a room with a built-in light over the desk.",
    price: 320,
    condition: "Like new",
    location: "Boys Hostel A, room 214",
  },
  {
    student: 6,
    kind: "item",
    title: "Woodland trekking shoes, UK size 9",
    category: "Fashion",
    description:
      "Bought for the NSS trek to Chitrakote, worn on three outings since. Soles are barely scuffed and the ankle support is untouched. Cleaned and kept in the original box.",
    price: 900,
    condition: "Good condition",
    location: "Boys Hostel A, room 305",
  },
  {
    student: 2,
    kind: "item",
    title: "Yonex GR 303 badminton racket with cover",
    category: "Sports",
    description:
      "Strung last semester with a fresh grip. Two small paint chips on the frame that do not affect play at all. Selling since I have switched to a heavier racket.",
    price: 700,
    condition: "Good condition",
    location: "Sports complex, weekday evenings",
  },
  {
    student: 1,
    kind: "item",
    title: "Engineering drawing sheets, pack of 20, A2",
    category: "Notes",
    description:
      "Unopened pack of 20 A2 sheets with the title block printed correctly for SSIPMT submissions. I bought two packs and only needed one.",
    price: 120,
    condition: "Brand new",
    location: "Girls Hostel, common room",
  },
  {
    student: 0,
    kind: "service",
    title: "Python and DSA assignment help",
    category: "Coding",
    description:
      "I will sit with you and work through your Python or DSA assignment so you actually understand it before the viva. Sessions happen in the CSE lab or over a call. No copying — I explain as we go, and you get a short write-up of the logic at the end.",
    price: 500,
    priceNote: "per assignment",
    turnaround: "Ready in 48 hours",
  },
  {
    student: 2,
    kind: "service",
    title: "Poster and logo design for club events",
    category: "Design",
    description:
      "Event posters, club logos, and Instagram sets for fests and society drives. You get the print-ready PDF plus the editable file, and two rounds of changes are included. I have done work for the robotics club and the annual tech fest.",
    price: 800,
    priceNote: "per poster",
    turnaround: "Ready in 3 days",
  },
  {
    student: 3,
    kind: "service",
    title: "LaTeX typesetting for seminar and project reports",
    category: "Writing",
    description:
      "Send me your Word draft and I will return a properly typeset LaTeX report with the SSIPMT title page, correct heading hierarchy, numbered figures and tables, and a clean bibliography. I also fix broken references before handing it back.",
    price: 350,
    priceNote: "per report",
    turnaround: "Ready in 2 days",
  },
  {
    student: 7,
    kind: "service",
    title: "Maths tutoring for first year — M1 and M2",
    category: "Tutoring",
    description:
      "Two-hour sessions covering the units people usually lose marks in: sequences and series, vector calculus, and Laplace transforms. I bring past papers, we solve them together, and you keep my handwritten notes.",
    price: 300,
    priceNote: "per session",
    turnaround: "Book at least a day ahead",
  },
  {
    student: 4,
    kind: "service",
    title: "Laptop repair, cleaning and OS setup",
    category: "Repairs",
    description:
      "Thermal paste change, fan cleaning, SSD and RAM upgrades, and clean installs of Windows or a dual-boot Ubuntu. Most jobs are finished the same evening. You supply the parts, I supply the tools and the patience.",
    price: 250,
    priceNote: "per machine",
    turnaround: "Mostly same day",
  },
  {
    student: 5,
    kind: "service",
    title: "Reel and short-video editing for fest pages",
    category: "Video & Photo",
    description:
      "Send raw clips from your phone and I will cut a vertical reel with clean captions, beat-matched cuts and a cover frame. I keep the edit minimal — no loud transitions, no stock overlays.",
    price: 600,
    priceNote: "per reel",
    turnaround: "Ready in 24 hours",
  },
  {
    student: 5,
    kind: "service",
    title: "Event photography and coverage for clubs",
    category: "Video & Photo",
    description:
      "Inductions, fests and society drives covered end to end: candid shots, group photos and a shared album the same evening. You get the credit on everything we publish.",
    price: 900,
    priceNote: "per event",
    turnaround: "Album shared the same day",
  },
  {
    student: 4,
    kind: "service",
    title: "Printing and spiral binding for project reports",
    category: "Writing",
    description:
      "Send the PDF, collect a properly bound report with a transparent cover and a black back sheet. Black and white or colour, single or double sided — print cost is billed at the shop rate.",
    price: 120,
    priceNote: "plus print cost",
    turnaround: "Ready in a few hours",
  },
];

const HOUR = 60 * 60 * 1000;

/**
 * Fills an empty campus with example students and listings so the marketplace
 * has something to show. It refuses to run once real posts exist.
 */
export const loadDemoListings = mutation({
  args: { note: v.optional(v.string()) },
  handler: async (ctx) => {
    const existing = await ctx.db.query("listings").first();
    if (existing) {
      throw new Error(
        "CampusMart already has listings on it, so the examples were not added.",
      );
    }

    const now = Date.now();
    const studentIds: Id<"users">[] = [];

    for (const student of STUDENTS) {
      const id = await ctx.db.insert("users", {
        name: student.name,
        email: student.email,
        emailVerificationTime: now,
        role: "member",
      });
      await ctx.db.insert("profiles", {
        userId: id,
        branch: student.branch,
        year: student.year,
        hostel: student.hostel,
        bio: student.bio,
        createdAt: now,
        updatedAt: now,
      });
      studentIds.push(id);
    }

    for (const [index, listing] of LISTINGS.entries()) {
      const createdAt = now - (index + 1) * 3 * HOUR - index * 11 * 60 * 1000;
      await ctx.db.insert("listings", {
        kind: listing.kind,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        price: listing.price,
        priceNote: listing.priceNote,
        condition: listing.condition,
        location: listing.location,
        turnaround: listing.turnaround,
        images: [],
        sellerId: studentIds[listing.student],
        status: "live",
        views: 12 + ((index * 7) % 60),
        createdAt,
        updatedAt: createdAt,
      });
    }

    return { students: studentIds.length, listings: LISTINGS.length };
  },
});
