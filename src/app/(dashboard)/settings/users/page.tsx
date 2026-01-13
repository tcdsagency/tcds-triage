"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  MoreVertical,
  Phone,
  Mail,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  Users,
  X,
  Loader2,
  PhoneCall,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { FEATURES, getFeaturesByCategory, getDefaultPermissions, getCategoryDisplayName } from "@/lib/feature-permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  initials: string;
  phone: string | null;
  avatarUrl: string | null;
  role: "admin" | "supervisor" | "agent";
  extension: string | null;
  directDial: string | null;
  cellPhone: string | null;
  agencyzoomId: string | null;
  agentCode: string | null;
  isAvailable: boolean;
  currentStatus: string | null;
  skillLevel: number | null;
  inLeadRotation: boolean;
  isActive: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  featurePermissions: Record<string, boolean> | null;
}

interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "admin" | "supervisor" | "agent";
  extension: string;
  directDial: string;
  cellPhone: string;
  agencyzoomId: string;
  agentCode: string;
  inLeadRotation: boolean;
  featurePermissions: Record<string, boolean>;
}

const initialFormData: UserFormData = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  role: "agent",
  extension: "",
  directDial: "",
  cellPhone: "",
  agencyzoomId: "",
  agentCode: "",
  inLeadRotation: true,
  featurePermissions: getDefaultPermissions(),
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [saving, setSaving] = useState(false);

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, [showInactive]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users?active=${!showInactive}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // Filter users by search
  const filteredUsers = users.filter((user) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.extension?.includes(search) ||
      user.phone?.includes(search)
    );
  });

  // Open modal for new user
  const handleAddUser = () => {
    setEditingUser(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || "",
      role: user.role,
      extension: user.extension || "",
      directDial: user.directDial || "",
      cellPhone: user.cellPhone || "",
      agencyzoomId: user.agencyzoomId || "",
      agentCode: user.agentCode || "",
      inLeadRotation: user.inLeadRotation,
      featurePermissions: user.featurePermissions || getDefaultPermissions(),
    });
    setIsModalOpen(true);
  };

  // Save user (create or update)
  const handleSave = async () => {
    if (!formData.email || !formData.firstName || !formData.lastName) {
      toast.error("Email, first name, and last name are required");
      return;
    }

    setSaving(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingUser ? "User updated" : "User created");
        setIsModalOpen(false);
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to save user");
      }
    } catch (error) {
      toast.error("Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  // Toggle user active status
  const handleToggleActive = async (user: User) => {
    try {
      if (user.isActive) {
        // Deactivate
        const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          toast.success(`${user.name} deactivated`);
          fetchUsers();
        } else {
          toast.error(data.error);
        }
      } else {
        // Reactivate
        const res = await fetch(`/api/users/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`${user.name} reactivated`);
          fetchUsers();
        } else {
          toast.error(data.error);
        }
      }
    } catch (error) {
      toast.error("Failed to update user status");
    }
  };

  // Role badge color
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-purple-100 text-purple-700">Admin</Badge>;
      case "supervisor":
        return <Badge className="bg-blue-100 text-blue-700">Supervisor</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700">Agent</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage team members and their permissions
          </p>
        </div>
        <Button onClick={handleAddUser} className="gap-2">
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or extension..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show inactive users
        </label>
      </div>

      {/* User List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              {search ? "No users match your search" : "No users found"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={cn(
                  "p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors",
                  !user.isActive && "opacity-60"
                )}
              >
                {/* Avatar */}
                <Avatar className="w-12 h-12">
                  <AvatarFallback
                    className={cn(
                      "text-sm font-medium",
                      user.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : user.role === "supervisor"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    )}
                  >
                    {user.initials}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {user.name}
                    </span>
                    {getRoleBadge(user.role)}
                    {!user.isActive && (
                      <Badge variant="outline" className="text-red-600 border-red-200">
                        Inactive
                      </Badge>
                    )}
                    {user.inLeadRotation && (
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        Lead Rotation
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {user.email}
                    </span>
                    {user.extension && (
                      <span className="flex items-center gap-1">
                        <PhoneCall className="w-3 h-3" />
                        Ext. {user.extension}
                      </span>
                    )}
                    {user.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {user.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditUser(user)}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleToggleActive(user)}
                      className={user.isActive ? "text-red-600" : "text-green-600"}
                    >
                      {user.isActive ? (
                        <>
                          <UserX className="w-4 h-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4 mr-2" />
                          Reactivate
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingUser ? "Edit User" : "Add New User"}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Name Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name *
                  </label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name *
                  </label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    placeholder="Doe"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email *
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="john@agency.com"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as "admin" | "supervisor" | "agent",
                    })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white text-gray-900 px-3 py-2 text-sm"
                >
                  <option value="agent">Agent</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Phone Numbers */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Office Phone
                  </label>
                  <Input
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="555-123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cell Phone
                  </label>
                  <Input
                    value={formData.cellPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, cellPhone: e.target.value })
                    }
                    placeholder="555-987-6543"
                  />
                </div>
              </div>

              {/* 3CX Integration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    3CX Extension
                  </label>
                  <Input
                    value={formData.extension}
                    onChange={(e) =>
                      setFormData({ ...formData, extension: e.target.value })
                    }
                    placeholder="101"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Direct Dial
                  </label>
                  <Input
                    value={formData.directDial}
                    onChange={(e) =>
                      setFormData({ ...formData, directDial: e.target.value })
                    }
                    placeholder="555-123-4567"
                  />
                </div>
              </div>

              {/* AgencyZoom Integration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    AgencyZoom ID
                  </label>
                  <Input
                    value={formData.agencyzoomId}
                    onChange={(e) =>
                      setFormData({ ...formData, agencyzoomId: e.target.value })
                    }
                    placeholder="12345"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Agent Code
                  </label>
                  <Input
                    value={formData.agentCode}
                    onChange={(e) =>
                      setFormData({ ...formData, agentCode: e.target.value })
                    }
                    placeholder="JD01"
                  />
                </div>
              </div>

              {/* Lead Rotation */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.inLeadRotation}
                  onChange={(e) =>
                    setFormData({ ...formData, inLeadRotation: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Include in lead rotation
                </span>
              </label>

              {/* Feature Permissions */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Feature Access
                  </span>
                </div>

                {Object.entries(getFeaturesByCategory()).map(([category, features]) => (
                  <div key={category} className="mb-4">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      {getCategoryDisplayName(category)}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {features.map((feature) => (
                        <label
                          key={feature.key}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          title={feature.description}
                        >
                          <input
                            type="checkbox"
                            checked={formData.featurePermissions[feature.key] ?? feature.defaultEnabled}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                featurePermissions: {
                                  ...formData.featurePermissions,
                                  [feature.key]: e.target.checked,
                                },
                              })
                            }
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {feature.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingUser ? "Save Changes" : "Create User"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
