"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Star,
  Plus,
  Search,
  Globe,
  ExternalLink,
  Trash2,
  Pencil,
  X,
  Link2,
  FolderOpen,
} from "lucide-react";

// Types
interface QuickLink {
  id: string;
  name: string;
  url: string;
  description: string | null;
  category: string | null;
  sortOrder: number;
  isFavorite: boolean;
  createdAt: string;
}

const CATEGORIES = [
  { value: "carrier", label: "Carrier Portals" },
  { value: "tool", label: "Tools & Utilities" },
  { value: "government", label: "Government" },
  { value: "reference", label: "Reference" },
  { value: "other", label: "Other" },
];

// Modal Component
function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// Link Form
function LinkForm({
  link,
  onSave,
  onCancel,
}: {
  link?: QuickLink;
  onSave: (data: Partial<QuickLink>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: link?.name || "",
    url: link?.url || "",
    description: link?.description || "",
    category: link?.category || "",
    sortOrder: link?.sortOrder || 0,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(formData);
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium mb-1">Name *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="My Website"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">URL *</label>
        <input
          type="url"
          required
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          placeholder="https://example.com"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          placeholder="Brief description of this link"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">None</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sort Order</label>
          <input
            type="number"
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          {link ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

// Main Page Component
export default function QuickLinksPage() {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);

  // Fetch links
  const fetchLinks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (showFavorites) params.set("favorites", "true");
      if (selectedCategory) params.set("category", selectedCategory);

      const res = await fetch(`/api/quick-links?${params}`);
      const data = await res.json();
      if (data.success) {
        setLinks(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch links:", error);
    } finally {
      setLoading(false);
    }
  }, [search, showFavorites, selectedCategory]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // Toggle favorite
  const toggleFavorite = async (id: string) => {
    try {
      await fetch(`/api/quick-links/${id}/favorite`, { method: "PATCH" });
      fetchLinks();
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  // Save link
  const saveLink = async (data: Partial<QuickLink>) => {
    try {
      const method = editingLink ? "PUT" : "POST";
      const url = editingLink ? `/api/quick-links/${editingLink.id}` : "/api/quick-links";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingLink(null);
        fetchLinks();
      }
    } catch (error) {
      console.error("Failed to save link:", error);
    }
  };

  // Delete link
  const deleteLink = async (id: string) => {
    if (!confirm("Are you sure you want to delete this link?")) return;
    try {
      await fetch(`/api/quick-links/${id}`, { method: "DELETE" });
      fetchLinks();
    } catch (error) {
      console.error("Failed to delete link:", error);
    }
  };

  // Group links by category
  const groupedLinks = links.reduce((acc, link) => {
    const cat = link.category || "uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(link);
    return acc;
  }, {} as Record<string, QuickLink[]>);

  // Get category label
  const getCategoryLabel = (cat: string) => {
    if (cat === "uncategorized") return "Uncategorized";
    return CATEGORIES.find((c) => c.value === cat)?.label || cat;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quick Links</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Useful websites and resources
          </p>
        </div>
        <button
          onClick={() => {
            setEditingLink(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Link
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search links..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        <button
          onClick={() => setShowFavorites(!showFavorites)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
            showFavorites
              ? "bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-400"
              : "hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          <Star className={`w-4 h-4 ${showFavorites ? "fill-current" : ""}`} />
          Favorites
        </button>
        <select
          value={selectedCategory || ""}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-12">
          <Link2 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No quick links found.</p>
          <p className="text-gray-400 text-sm">Add your first link to get started.</p>
        </div>
      ) : selectedCategory ? (
        // Single category view
        <div className="space-y-3">
          {links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onFavorite={() => toggleFavorite(link.id)}
              onEdit={() => {
                setEditingLink(link);
                setIsModalOpen(true);
              }}
              onDelete={() => deleteLink(link.id)}
            />
          ))}
        </div>
      ) : (
        // Grouped by category
        <div className="space-y-8">
          {Object.entries(groupedLinks)
            .sort(([a], [b]) => {
              // Sort: favorites first, then alphabetically
              if (a === "uncategorized") return 1;
              if (b === "uncategorized") return -1;
              return a.localeCompare(b);
            })
            .map(([category, categoryLinks]) => (
              <div key={category}>
                <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
                  <FolderOpen className="w-5 h-5 text-gray-400" />
                  {getCategoryLabel(category)}
                  <span className="text-sm font-normal text-gray-500">
                    ({categoryLinks.length})
                  </span>
                </h2>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {categoryLinks.map((link) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      onFavorite={() => toggleFavorite(link.id)}
                      onEdit={() => {
                        setEditingLink(link);
                        setIsModalOpen(true);
                      }}
                      onDelete={() => deleteLink(link.id)}
                      compact
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLink(null);
        }}
        title={editingLink ? "Edit Link" : "Add Link"}
      >
        <LinkForm
          link={editingLink || undefined}
          onSave={saveLink}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingLink(null);
          }}
        />
      </Modal>
    </div>
  );
}

// Link Card Component
function LinkCard({
  link,
  onFavorite,
  onEdit,
  onDelete,
  compact = false,
}: {
  link: QuickLink;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  // Get favicon URL
  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  const faviconUrl = getFaviconUrl(link.url);

  if (compact) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
        <div className="flex items-center gap-3">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            {faviconUrl ? (
              <img src={faviconUrl} alt="" className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Globe className="w-5 h-5 text-gray-400 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-medium truncate">{link.name}</div>
              {link.description && (
                <div className="text-xs text-gray-500 truncate">{link.description}</div>
              )}
            </div>
          </a>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onFavorite}
              className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                link.isFavorite ? "text-yellow-500" : "text-gray-400"
              }`}
            >
              <Star className={`w-4 h-4 ${link.isFavorite ? "fill-current" : ""}`} />
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {faviconUrl ? (
            <img src={faviconUrl} alt="" className="w-6 h-6 flex-shrink-0 mt-0.5" />
          ) : (
            <Globe className="w-6 h-6 text-gray-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-lg hover:text-blue-600 flex items-center gap-2"
            >
              {link.name}
              <ExternalLink className="w-4 h-4" />
            </a>
            {link.description && (
              <p className="text-sm text-gray-500 mt-1">{link.description}</p>
            )}
            <div className="text-xs text-gray-400 mt-1 truncate">{link.url}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-4">
          <button
            onClick={onFavorite}
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
              link.isFavorite ? "text-yellow-500" : "text-gray-400"
            }`}
          >
            <Star className={`w-5 h-5 ${link.isFavorite ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-red-400"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
