"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Star,
  Plus,
  Search,
  Phone,
  Mail,
  Globe,
  Building2,
  Users,
  Percent,
  Trash2,
  Pencil,
  X,
} from "lucide-react";

// Types
interface Carrier {
  id: string;
  name: string;
  website: string | null;
  products: string | null;
  newBusinessCommission: string | null;
  renewalCommission: string | null;
  agencySupportPhone: string | null;
  agencyCode: string | null;
  marketingRepName: string | null;
  marketingRepEmail: string | null;
  marketingRepPhone: string | null;
  isFavorite: boolean;
  createdAt: string;
}

interface Broker {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  isFavorite: boolean;
  createdAt: string;
}

type TabType = "carriers" | "brokers";

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

// Carrier Form
function CarrierForm({
  carrier,
  onSave,
  onCancel,
}: {
  carrier?: Carrier;
  onSave: (data: Partial<Carrier>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: carrier?.name || "",
    website: carrier?.website || "",
    products: carrier?.products || "",
    newBusinessCommission: carrier?.newBusinessCommission || "",
    renewalCommission: carrier?.renewalCommission || "",
    agencySupportPhone: carrier?.agencySupportPhone || "",
    agencyCode: carrier?.agencyCode || "",
    marketingRepName: carrier?.marketingRepName || "",
    marketingRepEmail: carrier?.marketingRepEmail || "",
    marketingRepPhone: carrier?.marketingRepPhone || "",
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
        <label className="block text-sm font-medium mb-1">Carrier Name *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Products (comma-separated)</label>
        <input
          type="text"
          value={formData.products}
          onChange={(e) => setFormData({ ...formData, products: e.target.value })}
          placeholder="Auto, Home, Umbrella"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">New Business Commission</label>
          <input
            type="text"
            value={formData.newBusinessCommission}
            onChange={(e) => setFormData({ ...formData, newBusinessCommission: e.target.value })}
            placeholder="15%"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Renewal Commission</label>
          <input
            type="text"
            value={formData.renewalCommission}
            onChange={(e) => setFormData({ ...formData, renewalCommission: e.target.value })}
            placeholder="12%"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Agency Code</label>
          <input
            type="text"
            value={formData.agencyCode}
            onChange={(e) => setFormData({ ...formData, agencyCode: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Agency Support Phone</label>
          <input
            type="text"
            value={formData.agencySupportPhone}
            onChange={(e) => setFormData({ ...formData, agencySupportPhone: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Website</label>
        <input
          type="url"
          value={formData.website}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div className="border-t pt-4 mt-4">
        <h4 className="font-medium mb-3">Marketing Rep</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={formData.marketingRepName}
              onChange={(e) => setFormData({ ...formData, marketingRepName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={formData.marketingRepEmail}
                onChange={(e) => setFormData({ ...formData, marketingRepEmail: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="text"
                value={formData.marketingRepPhone}
                onChange={(e) => setFormData({ ...formData, marketingRepPhone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>
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
          {carrier ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

// Broker Form
function BrokerForm({
  broker,
  onSave,
  onCancel,
}: {
  broker?: Broker;
  onSave: (data: Partial<Broker>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: broker?.name || "",
    contactName: broker?.contactName || "",
    email: broker?.email || "",
    phone: broker?.phone || "",
    website: broker?.website || "",
    notes: broker?.notes || "",
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
        <label className="block text-sm font-medium mb-1">Broker Name *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Contact Name</label>
        <input
          type="text"
          value={formData.contactName}
          onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Website</label>
        <input
          type="url"
          value={formData.website}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        />
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
          {broker ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

// Main Page Component
export default function CarriersBrokersPage() {
  const [activeTab, setActiveTab] = useState<TabType>("carriers");
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [editingBroker, setEditingBroker] = useState<Broker | null>(null);

  // Fetch carriers
  const fetchCarriers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (showFavorites) params.set("favorites", "true");

      const res = await fetch(`/api/agency-carriers?${params}`);
      const data = await res.json();
      if (data.success) {
        setCarriers(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch carriers:", error);
    }
  }, [search, showFavorites]);

  // Fetch brokers
  const fetchBrokers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (showFavorites) params.set("favorites", "true");

      const res = await fetch(`/api/es-brokers?${params}`);
      const data = await res.json();
      if (data.success) {
        setBrokers(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch brokers:", error);
    }
  }, [search, showFavorites]);

  // Load data
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCarriers(), fetchBrokers()]).finally(() => setLoading(false));
  }, [fetchCarriers, fetchBrokers]);

  // Toggle favorite
  const toggleFavorite = async (type: "carrier" | "broker", id: string) => {
    const endpoint = type === "carrier" ? `/api/agency-carriers/${id}/favorite` : `/api/es-brokers/${id}/favorite`;
    try {
      await fetch(endpoint, { method: "PATCH" });
      if (type === "carrier") {
        fetchCarriers();
      } else {
        fetchBrokers();
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  // Save carrier
  const saveCarrier = async (data: Partial<Carrier>) => {
    try {
      const method = editingCarrier ? "PUT" : "POST";
      const url = editingCarrier ? `/api/agency-carriers/${editingCarrier.id}` : "/api/agency-carriers";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingCarrier(null);
        fetchCarriers();
      }
    } catch (error) {
      console.error("Failed to save carrier:", error);
    }
  };

  // Save broker
  const saveBroker = async (data: Partial<Broker>) => {
    try {
      const method = editingBroker ? "PUT" : "POST";
      const url = editingBroker ? `/api/es-brokers/${editingBroker.id}` : "/api/es-brokers";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingBroker(null);
        fetchBrokers();
      }
    } catch (error) {
      console.error("Failed to save broker:", error);
    }
  };

  // Delete carrier
  const deleteCarrier = async (id: string) => {
    if (!confirm("Are you sure you want to delete this carrier?")) return;
    try {
      await fetch(`/api/agency-carriers/${id}`, { method: "DELETE" });
      fetchCarriers();
    } catch (error) {
      console.error("Failed to delete carrier:", error);
    }
  };

  // Delete broker
  const deleteBroker = async (id: string) => {
    if (!confirm("Are you sure you want to delete this broker?")) return;
    try {
      await fetch(`/api/es-brokers/${id}`, { method: "DELETE" });
      fetchBrokers();
    } catch (error) {
      console.error("Failed to delete broker:", error);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Carriers & Brokers</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage your appointed carriers and E&S brokers
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCarrier(null);
            setEditingBroker(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add {activeTab === "carriers" ? "Carrier" : "Broker"}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
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
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab("carriers")}
          className={`px-4 py-2 font-medium border-b-2 -mb-px ${
            activeTab === "carriers"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Carriers ({carriers.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab("brokers")}
          className={`px-4 py-2 font-medium border-b-2 -mb-px ${
            activeTab === "brokers"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            E&S Brokers ({brokers.length})
          </div>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : activeTab === "carriers" ? (
        <div className="space-y-4">
          {carriers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No carriers found. Add your first carrier to get started.
            </div>
          ) : (
            carriers.map((carrier) => (
              <div
                key={carrier.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{carrier.name}</h3>
                      {carrier.agencyCode && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {carrier.agencyCode}
                        </span>
                      )}
                    </div>
                    {carrier.products && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {carrier.products.split(",").map((p, i) => (
                          <span
                            key={i}
                            className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded"
                          >
                            {p.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
                      {(carrier.newBusinessCommission || carrier.renewalCommission) && (
                        <div className="flex items-center gap-1">
                          <Percent className="w-4 h-4" />
                          NB: {carrier.newBusinessCommission || "N/A"} / Renewal:{" "}
                          {carrier.renewalCommission || "N/A"}
                        </div>
                      )}
                      {carrier.agencySupportPhone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {carrier.agencySupportPhone}
                        </div>
                      )}
                      {carrier.website && (
                        <a
                          href={carrier.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Globe className="w-4 h-4" />
                          Website
                        </a>
                      )}
                    </div>
                    {carrier.marketingRepName && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-sm text-gray-500">Marketing Rep: {carrier.marketingRepName}</div>
                        <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                          {carrier.marketingRepEmail && (
                            <a
                              href={`mailto:${carrier.marketingRepEmail}`}
                              className="flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              <Mail className="w-4 h-4" />
                              {carrier.marketingRepEmail}
                            </a>
                          )}
                          {carrier.marketingRepPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {carrier.marketingRepPhone}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFavorite("carrier", carrier.id)}
                      className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        carrier.isFavorite ? "text-yellow-500" : "text-gray-400"
                      }`}
                    >
                      <Star className={`w-5 h-5 ${carrier.isFavorite ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingCarrier(carrier);
                        setIsModalOpen(true);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteCarrier(carrier.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-red-400"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {brokers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No E&S brokers found. Add your first broker to get started.
            </div>
          ) : (
            brokers.map((broker) => (
              <div
                key={broker.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{broker.name}</h3>
                    {broker.contactName && (
                      <div className="text-sm text-gray-500 mt-1">Contact: {broker.contactName}</div>
                    )}
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
                      {broker.email && (
                        <a
                          href={`mailto:${broker.email}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Mail className="w-4 h-4" />
                          {broker.email}
                        </a>
                      )}
                      {broker.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {broker.phone}
                        </span>
                      )}
                      {broker.website && (
                        <a
                          href={broker.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Globe className="w-4 h-4" />
                          Website
                        </a>
                      )}
                    </div>
                    {broker.notes && (
                      <div className="mt-3 text-sm text-gray-500 italic">{broker.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFavorite("broker", broker.id)}
                      className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        broker.isFavorite ? "text-yellow-500" : "text-gray-400"
                      }`}
                    >
                      <Star className={`w-5 h-5 ${broker.isFavorite ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingBroker(broker);
                        setIsModalOpen(true);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteBroker(broker.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-red-400"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCarrier(null);
          setEditingBroker(null);
        }}
        title={
          activeTab === "carriers"
            ? editingCarrier
              ? "Edit Carrier"
              : "Add Carrier"
            : editingBroker
            ? "Edit Broker"
            : "Add Broker"
        }
      >
        {activeTab === "carriers" ? (
          <CarrierForm
            carrier={editingCarrier || undefined}
            onSave={saveCarrier}
            onCancel={() => {
              setIsModalOpen(false);
              setEditingCarrier(null);
            }}
          />
        ) : (
          <BrokerForm
            broker={editingBroker || undefined}
            onSave={saveBroker}
            onCancel={() => {
              setIsModalOpen(false);
              setEditingBroker(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
