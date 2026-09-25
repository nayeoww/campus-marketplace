import { AppShell } from "@/components/campus/AppShell";
import { Breadcrumbs, EmptyState, Loading, Notice } from "@/components/campus/Bits";
import { ListingCard } from "@/components/campus/ListingCard";
import { api } from "@/convex/_generated/api";
import { useCampusUser } from "@/hooks/use-campus-user";
import {
  CATEGORIES,
  CAMPUS_NAME,
  CONDITIONS,
  KIND_META,
  type ListingKind,
  type ListingRow,
} from "@/lib/campus";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

const MAX_IMAGES = 6;
const MAX_FILE_MB = 6;

const KIND_ORDER: ListingKind[] = ["item", "service"];

type FieldCopy = {
  priceLabel: string;
  priceNotePlaceholder: string;
  turnaroundLabel: string;
  turnaroundPlaceholder: string;
  locationLabel: string;
  titlePlaceholder: string;
  descriptionPlaceholder: string;
};

const FIELD_COPY: Record<ListingKind, FieldCopy> = {
  item: {
    priceLabel: "Price (₹)",
    priceNotePlaceholder: "e.g. slightly negotiable",
    turnaroundLabel: "",
    turnaroundPlaceholder: "",
    locationLabel: "Where can they collect it?",
    titlePlaceholder: "Casio fx-991ES PLUS scientific calculator",
    descriptionPlaceholder:
      "How long you have had it, what condition it is in, what is included, and anything a buyer should check before paying.",
  },
  service: {
    priceLabel: "Your rate (₹)",
    priceNotePlaceholder: "per assignment, per poster, per session…",
    turnaroundLabel: "How long does it take?",
    turnaroundPlaceholder: "Ready in 48 hours",
    locationLabel: "Where do you work from?",
    titlePlaceholder: "LaTeX typesetting for seminar reports",
    descriptionPlaceholder:
      "What exactly you will deliver, what you need from the client, and what your price covers. Be specific about turnaround.",
  },
};

export default function PostListing({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { me } = useCampusUser();

  const existing = useQuery(
    api.listings.byId,
    mode === "edit" && id ? { id: id as never } : "skip",
  );

  const createListing = useMutation(api.listings.create);
  const updateListing = useMutation(api.listings.update);
  const generateUploadUrl = useMutation(api.listings.generateUploadUrl);
  const resolveImageUrl = useMutation(api.listings.imageUrl);

  const [kind, setKind] = useState<ListingKind>("item");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [condition, setCondition] = useState("");
  const [location, setLocation] = useState("");
  const [turnaround, setTurnaround] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Fill the form once with the post being edited.
  if (mode === "edit" && existing?.listing && !hydrated) {
    const listing = existing.listing;
    setKind(listing.kind);
    setTitle(listing.title);
    setCategory(listing.category);
    setPrice(listing.price !== undefined ? String(listing.price) : "");
    setPriceNote(listing.priceNote ?? "");
    setCondition(listing.condition ?? "");
    setLocation(listing.location ?? "");
    setTurnaround(listing.turnaround ?? "");
    setDescription(listing.description);
    setImages(listing.images ?? []);
    setHydrated(true);
  }

  const copy = FIELD_COPY[kind];
  const categoryOptions = CATEGORIES[kind];
  const effectiveCategory = categoryOptions.includes(category) ? category : "";

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_IMAGES} photos.`);
      return;
    }

    const selected = Array.from(files).slice(0, room);
    setUploading(true);
    setError(null);

    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name} is not an image file.`);
        }
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          throw new Error(`${file.name} is larger than ${MAX_FILE_MB} MB.`);
        }

        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) {
          throw new Error("The upload did not go through. Try again.");
        }
        const { storageId } = (await response.json()) as { storageId: string };
        const { url } = await resolveImageUrl({ storageId: storageId as never });
        uploaded.push(url);
      }
      setImages((current) => [...current, ...uploaded]);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Those photos could not be added.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      title,
      description,
      category: effectiveCategory,
      price: price === "" ? undefined : Number(price),
      priceNote: priceNote || undefined,
      condition: kind === "item" ? condition || undefined : undefined,
      location: kind === "service" ? undefined : location || undefined,
      turnaround: kind === "item" ? undefined : turnaround || undefined,
      images,
    };

    try {
      if (mode === "edit" && id) {
        await updateListing({ ...payload, id: id as never });
        toast.success("Post updated.");
        navigate(`/listing/${id}`);
      } else {
        const { id: newId } = await createListing({ ...payload, kind });
        toast.success("Your post is live on CampusMart.");
        navigate(`/listing/${newId}`);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message.replace(/^\[.*?\]\s*/, "")
          : "Your post could not be saved.",
      );
      setSaving(false);
    }
  };

  const preview: ListingRow = {
    _id: "preview" as never,
    _creationTime: Date.now(),
    kind,
    title: title.trim() || "Your title appears here",
    description:
      description.trim() ||
      "Your description appears here. Say what you are selling, offering or asking for.",
    category: effectiveCategory || categoryOptions[0],
    price: price === "" ? undefined : Number(price),
    priceNote: priceNote || undefined,
    condition: condition || undefined,
    location: location || undefined,
    turnaround: turnaround || undefined,
    images,
    sellerId: "preview" as never,
    status: "live",
    views: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    seller: {
      _id: "preview",
      name: me?.name ?? "You",
      branch: me?.profile?.branch ?? null,
      year: me?.profile?.year ?? null,
      verified: Boolean(me?.emailVerified),
      campusAccount: Boolean(me?.campusAccount),
    },
    saved: false,
    isOwner: true,
  };

  if (mode === "edit") {
    if (existing === undefined) {
      return (
        <AppShell>
          <div className="cm-shell">
            <Loading label="Opening your post" />
          </div>
        </AppShell>
      );
    }
    if (existing === null || !existing.listing.isOwner) {
      return (
        <AppShell>
          <div className="cm-shell">
            <EmptyState
              eyebrow="Not yours to edit"
              title="You can only edit posts you created"
              body="Head to My listings to manage everything you have posted, or browse the marketplace for something else."
            >
              <Link to="/my-listings" className="cm-btn">
                Go to my listings
              </Link>
            </EmptyState>
          </div>
        </AppShell>
      );
    }
  }

  return (
    <AppShell>
      <div className="cm-shell">
        <Breadcrumbs
          items={[
            { label: CAMPUS_NAME, to: "/" },
            { label: "My listings", to: "/my-listings" },
            { label: mode === "edit" ? "Edit post" : "New post" },
          ]}
        />

        <header className="cm-page-head">
          <div>
            <p className="cm-eyebrow">
              {mode === "edit" ? "Edit post" : "New post"}
              <span className="cm-eyebrow__rule" />
              {KIND_META[kind].label}
            </p>
            <h1
              className="cm-display cm-h2 cm-page-head__title"
              style={{ maxWidth: "22ch" }}
            >
              {mode === "edit"
                ? "Change the details students see"
                : "Put something on the board"}
            </h1>
            <p className="cm-lede" style={{ marginTop: 16 }}>
              {mode === "edit"
                ? "Update the price, the description or the photos. Your post keeps its place in the board."
                : "Pick what you are posting, fill in the details, and add a few photos. Photos of the actual item get replies far more often than none at all."}
            </p>
          </div>
          <div className="cm-stack" style={{ gap: 12 }}>
            <p className="cm-note">
              Posts are free and stay on the board until you mark them sold or
              close them.
            </p>
          </div>
        </header>

        <form className="cm-composer" onSubmit={handleSubmit}>
          <div className="cm-stack" style={{ gap: 22 }}>
            {mode === "create" && (
              <div className="cm-tabs" role="tablist" aria-label="What are you posting">
                {KIND_ORDER.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={kind === option}
                    className="cm-tab"
                    data-active={kind === option}
                    onClick={() => {
                      setKind(option);
                      setCategory("");
                      setCondition("");
                      setLocation("");
                      setTurnaround("");
                    }}
                  >
                    {KIND_META[option].label}
                    <small>{KIND_META[option].noun}</small>
                  </button>
                ))}
              </div>
            )}

            <div className="cm-form-block">
              <label className="cm-field">
                <span className="cm-label">Title</span>
                <input
                  className="cm-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={copy.titlePlaceholder}
                  maxLength={90}
                  required
                />
              </label>

              <div className="cm-form-grid">
                <label className="cm-field">
                  <span className="cm-label">Category</span>
                  <span className="cm-select-wrap">
                    <select
                      className="cm-select"
                      value={effectiveCategory}
                      onChange={(event) => setCategory(event.target.value)}
                      required
                    >
                      <option value="">Choose a category</option>
                      {categoryOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>

                <label className="cm-field">
                  <span className="cm-label">{copy.priceLabel}</span>
                  <input
                    className="cm-input"
                    type="number"
                    min={0}
                    step={1}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="650"
                  />
                </label>

                <label className="cm-field">
                  <span className="cm-label">Price note</span>
                  <input
                    className="cm-input"
                    value={priceNote}
                    onChange={(event) => setPriceNote(event.target.value)}
                    placeholder={copy.priceNotePlaceholder}
                    maxLength={40}
                  />
                </label>

                {kind === "item" && (
                  <label className="cm-field">
                    <span className="cm-label">Condition</span>
                    <span className="cm-select-wrap">
                      <select
                        className="cm-select"
                        value={condition}
                        onChange={(event) => setCondition(event.target.value)}
                      >
                        <option value="">Not specified</option>
                        {CONDITIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                )}

                {kind !== "item" && (
                  <label className="cm-field">
                    <span className="cm-label">{copy.turnaroundLabel}</span>
                    <input
                      className="cm-input"
                      value={turnaround}
                      onChange={(event) => setTurnaround(event.target.value)}
                      placeholder={copy.turnaroundPlaceholder}
                      maxLength={60}
                    />
                  </label>
                )}

                {kind !== "service" && (
                  <label className="cm-field">
                    <span className="cm-label">{copy.locationLabel}</span>
                    <input
                      className="cm-input"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      placeholder="Boys Hostel A, room 214"
                      maxLength={60}
                    />
                  </label>
                )}
              </div>

              <label className="cm-field">
                <span className="cm-label">Description</span>
                <textarea
                  className="cm-textarea"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={copy.descriptionPlaceholder}
                  maxLength={2000}
                  required
                />
                <span className="cm-field__hint">
                  {description.length}/2000 characters. Be honest about wear and
                  tear — it saves everyone a trip.
                </span>
              </label>
            </div>

            <div className="cm-form-block">
              <div>
                <p className="cm-label" style={{ marginBottom: 8 }}>
                  Photos
                </p>
                <p className="cm-note">
                  Up to {MAX_IMAGES} images, {MAX_FILE_MB} MB each. The first one
                  becomes the cover on the board.
                </p>
              </div>

              <div
                className={`cm-upload${dragging ? " cm-upload--active" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void handleFiles(event.dataTransfer.files);
                }}
              >
                <div className="cm-upload__row">
                  <label className="cm-btn cm-btn--quiet cm-btn--sm">
                    {uploading ? "Uploading…" : "Choose photos"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(event) => {
                        void handleFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <span className="cm-note">
                    …or drag them into this box. {images.length}/{MAX_IMAGES} added.
                  </span>
                </div>

                {images.length > 0 && (
                  <div className="cm-tiles">
                    {images.map((image, index) => (
                      <div className="cm-tile" key={image}>
                        <img src={image} alt={`Upload ${index + 1}`} />
                        <button
                          type="button"
                          className="cm-tile__remove"
                          aria-label={`Remove photo ${index + 1}`}
                          onClick={() =>
                            setImages((current) =>
                              current.filter((url) => url !== image),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {images.length === 0 && !uploading && (
                  <p className="cm-note">
                    No photos yet. Your post will show a printed stand-in card
                    instead — you can add photos later from My listings.
                  </p>
                )}
              </div>
            </div>

            {error && <Notice tone="error">{error}</Notice>}

            <div className="cm-actions">
              <button
                type="submit"
                className="cm-btn cm-btn--accent cm-btn--lg"
                disabled={
                  saving ||
                  uploading ||
                  !title.trim() ||
                  !effectiveCategory ||
                  description.trim().length < 15
                }
              >
                {saving
                  ? "Saving…"
                  : mode === "edit"
                    ? "Save changes"
                    : `Publish ${KIND_META[kind].noun.toLowerCase()}`}
              </button>
              <Link
                to={mode === "edit" && id ? `/listing/${id}` : "/my-listings"}
                className="cm-btn cm-btn--quiet cm-btn--lg"
              >
                Cancel
              </Link>
            </div>
          </div>

          <aside className="cm-preview">
            <p className="cm-preview__label">Preview — how it looks on the board</p>
            <ListingCard listing={preview} />
            <p className="cm-note">
              Your name, branch and year sit under the post, along with how long
              ago you published it. Your email address never appears.
            </p>
            <div className="cm-fact-list">
              <div className="cm-fact">
                <span>Posting as</span>
                <span className="cm-meta">{me?.name ?? "You"}</span>
              </div>
              <div className="cm-fact">
                <span>Verification</span>
                <span className="cm-meta">
                  {me?.emailVerified ? "Verified student" : "Pending"}
                </span>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </AppShell>
  );
}
