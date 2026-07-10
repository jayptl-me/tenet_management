'use client';

import { useState, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Search,
  Wrench,
  Wifi,
  Zap,
  Droplets,
  Thermometer,
  Shirt,
  Sparkles,
  BedSingle,
  ScrollText,
  MoonStar,
  Fan,
  Refrigerator,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { AmenityDefinition, AmenityCategory } from '@pg/types';

// ── Icon mapping for the picker (commonly used lucide icons) ──
const ICON_OPTIONS: { name: string; icon: React.ReactNode }[] = [
  { name: 'wifi', icon: <Wifi className="h-4 w-4" /> },
  { name: 'zap', icon: <Zap className="h-4 w-4" /> },
  { name: 'droplets', icon: <Droplets className="h-4 w-4" /> },
  { name: 'thermometer', icon: <Thermometer className="h-4 w-4" /> },
  { name: 'shirt', icon: <Shirt className="h-4 w-4" /> },
  { name: 'sparkles', icon: <Sparkles className="h-4 w-4" /> },
  { name: 'bed-single', icon: <BedSingle className="h-4 w-4" /> },
  { name: 'scroll-text', icon: <ScrollText className="h-4 w-4" /> },
  { name: 'moon-star', icon: <MoonStar className="h-4 w-4" /> },
  { name: 'fan', icon: <Fan className="h-4 w-4" /> },
  { name: 'refrigerator', icon: <Refrigerator className="h-4 w-4" /> },
  { name: 'wrench', icon: <Wrench className="h-4 w-4" /> },
];

const CATEGORY_OPTIONS: { value: AmenityCategory; label: string; color: string }[] = [
  {
    value: 'essential',
    label: 'Essential',
    color: 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-700)]',
  },
  {
    value: 'appliance',
    label: 'Appliance',
    color: 'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]',
  },
  {
    value: 'furnishing',
    label: 'Furnishing',
    color: 'bg-[color:var(--color-success-100)] text-[color:var(--color-success-700)]',
  },
  {
    value: 'other',
    label: 'Other',
    color: 'bg-[color:var(--color-surface-200)] text-[color:var(--color-surface-700)]',
  },
];

const emptyDefinition: AmenityDefinition = {
  key: '',
  label: '',
  icon: 'wrench',
  category: 'other',
  showAsStatusLabel: false,
  isPerFloor: false,
};

// ── Simple Zod-like validation (no zod on client, manual) ──
function validateDefinition(def: AmenityDefinition): string[] {
  const errors: string[] = [];
  if (!def.key.match(/^[a-z][a-z0-9_]*$/)) {
    errors.push('Key must be lowercase alphanumeric (with underscores)');
  }
  if (!def.label.trim()) {
    errors.push('Label is required');
  }
  if (def.label.length > 50) {
    errors.push('Label must be 50 characters or fewer');
  }
  if (!def.icon.trim()) {
    errors.push('Icon is required');
  }
  if (def.maxPerFloor !== undefined && (def.maxPerFloor < 0 || def.maxPerFloor > 10)) {
    errors.push('Max per floor must be 0-10');
  }
  return errors;
}

// ── Resolve icon component by string name ──
function getIconComponent(iconName: string): React.ReactNode {
  const found = ICON_OPTIONS.find((i) => i.name === iconName);
  return found?.icon ?? <Wrench className="h-4 w-4" />;
}

// ── Resolve category badge ──
function getCategoryBadge(category: AmenityCategory): string {
  const found = CATEGORY_OPTIONS.find((c) => c.value === category);
  return (
    found?.color ?? 'bg-[color:var(--color-surface-200)] text-[color:var(--color-surface-700)]'
  );
}

interface AmenityTypesTabProps {
  definitions: AmenityDefinition[];
  onChange: (definitions: AmenityDefinition[]) => void;
}

export default function AmenityTypesTab({ definitions, onChange }: AmenityTypesTabProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<AmenityDefinition>(emptyDefinition);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [iconSearch, setIconSearch] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const filteredIcons = useMemo(() => {
    if (!iconSearch.trim()) return ICON_OPTIONS;
    return ICON_OPTIONS.filter((i) => i.name.toLowerCase().includes(iconSearch.toLowerCase()));
  }, [iconSearch]);

  // ── Start adding new ──
  const handleStartAdd = () => {
    setFormData({ ...emptyDefinition });
    setFormErrors([]);
    setIsAdding(true);
    setEditingIndex(null);
    setShowIconPicker(false);
    setIconSearch('');
  };

  // ── Start editing existing ──
  const handleStartEdit = (index: number) => {
    setFormData({ ...definitions[index] });
    setFormErrors([]);
    setEditingIndex(index);
    setIsAdding(false);
    setShowIconPicker(false);
    setIconSearch('');
  };

  // ── Cancel form ──
  const handleCancel = () => {
    setEditingIndex(null);
    setIsAdding(false);
    setFormErrors([]);
    setShowIconPicker(false);
  };

  // ── Save (add or edit) ──
  const handleSave = () => {
    const errors = validateDefinition(formData);
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    // Check for duplicate key
    const dupIndex = definitions.findIndex((d, i) => d.key === formData.key && i !== editingIndex);
    if (dupIndex !== -1) {
      setFormErrors(['An amenity with this key already exists']);
      return;
    }

    if (isAdding) {
      onChange([...definitions, { ...formData }]);
    } else if (editingIndex !== null) {
      const updated = [...definitions];
      updated[editingIndex] = { ...formData };
      onChange(updated);
    }

    handleCancel();
  };

  // ── Delete ──
  const handleConfirmDelete = () => {
    if (deleteIndex === null) return;
    const updated = definitions.filter((_, i) => i !== deleteIndex);
    onChange(updated);
    setDeleteIndex(null);
  };

  // ── Update form field ──
  const updateField = <K extends keyof AmenityDefinition>(key: K, value: AmenityDefinition[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFormErrors([]);
  };

  const isEditing = editingIndex !== null || isAdding;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-[family:var(--font-display)] text-lg font-bold text-[color:var(--color-text-primary)]">
            Amenity Types
          </h3>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-muted)]">
            Define and manage all amenities available across floors and rooms. These definitions
            control what appears in service status indicators, room detail cards, and complaint
            categories.
          </p>
        </div>
        {!isEditing && (
          <Button onClick={handleStartAdd} size="sm">
            <Plus className="h-4 w-4" />
            Add Amenity
          </Button>
        )}
      </div>

      {/* ── Add / Edit Form ── */}
      {isEditing && (
        <div className="rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-[family:var(--font-display)] text-sm font-bold text-[color:var(--color-text-primary)]">
              {isAdding ? 'New Amenity' : 'Edit Amenity'}
            </h4>
            <button
              onClick={handleCancel}
              className="rounded-[var(--radius-md)] p-1 text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-secondary)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {formErrors.length > 0 && (
            <div className="mb-4 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] p-3 text-sm text-[color:var(--color-danger-700)]">
              {formErrors.map((err, i) => (
                <p key={i} className="font-semibold">
                  • {err}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {/* Key + Label row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Key"
                value={formData.key}
                onChange={(e) =>
                  updateField('key', e.target.value.toLowerCase().replace(/\s+/g, '_'))
                }
                placeholder="e.g. washing_machine"
                disabled={editingIndex !== null}
              />
              <Input
                label="Label"
                value={formData.label}
                onChange={(e) => updateField('label', e.target.value)}
                placeholder="e.g. Washing Machine"
              />
            </div>

            {/* Icon picker */}
            <div>
              <label className="font-[family:var(--font-body)] mb-1.5 block text-sm font-semibold text-[color:var(--color-text-primary)]">
                Icon
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-4 py-2.5 text-left text-sm transition-colors hover:border-[color:var(--color-brand-500)]"
                >
                  <span className="flex-shrink-0 text-[color:var(--color-text-secondary)]">
                    {getIconComponent(formData.icon)}
                  </span>
                  <span className="flex-1 font-semibold text-[color:var(--color-text-primary)]">
                    {formData.icon}
                  </span>
                  <span className="text-xs text-[color:var(--color-text-muted)]">▼</span>
                </button>

                {showIconPicker && (
                  <div className="absolute z-10 mt-1 w-full rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] shadow-[var(--shadow-dropdown)]">
                    <div className="border-b-[length:var(--bw-default)] border-b-[color:var(--border-color)] p-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
                        <input
                          type="text"
                          value={iconSearch}
                          onChange={(e) => setIconSearch(e.target.value)}
                          placeholder="Search icons..."
                          className="w-full rounded-[var(--radius-sm)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] py-1.5 pl-8 pr-3 text-xs focus:border-[color:var(--color-brand-500)] focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="max-h-[160px] overflow-y-auto p-2">
                      <div className="grid grid-cols-6 gap-1">
                        {filteredIcons.map((opt) => (
                          <button
                            key={opt.name}
                            type="button"
                            onClick={() => {
                              updateField('icon', opt.name);
                              setShowIconPicker(false);
                              setIconSearch('');
                            }}
                            className={`flex flex-col items-center gap-0.5 rounded-[var(--radius-sm)] p-1.5 text-center transition-colors ${
                              formData.icon === opt.name
                                ? 'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]'
                                : 'text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-card-bg)] hover:text-[color:var(--color-text-primary)]'
                            }`}
                            title={opt.name}
                          >
                            {opt.icon}
                            <span className="text-[9px] leading-none">{opt.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="font-[family:var(--font-body)] mb-1.5 block text-sm font-semibold text-[color:var(--color-text-primary)]">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => updateField('category', cat.value)}
                    className={`font-[family:var(--font-display)] inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                      formData.category === cat.value
                        ? `${cat.color} border-[length:var(--bw-default)] border-[color:var(--border-color)] shadow-[var(--shadow-button)]`
                        : 'border-[length:var(--bw-default)] border-transparent bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Show as status label */}
              <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-4 py-3 transition-colors hover:border-[color:var(--color-brand-500)]">
                <input
                  type="checkbox"
                  checked={formData.showAsStatusLabel}
                  onChange={(e) => updateField('showAsStatusLabel', e.target.checked)}
                  className="h-4 w-4 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)] text-[color:var(--color-brand-500)] focus:ring-[color:var(--color-brand-500)]"
                />
                <div>
                  <span className="block text-sm font-semibold text-[color:var(--color-text-primary)]">
                    Show as Status Label
                  </span>
                  <span className="block text-xs text-[color:var(--color-text-muted)]">
                    Display green/red dot on room/floor list views
                  </span>
                </div>
              </label>

              {/* Is per floor */}
              <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-4 py-3 transition-colors hover:border-[color:var(--color-brand-500)]">
                <input
                  type="checkbox"
                  checked={formData.isPerFloor}
                  onChange={(e) => updateField('isPerFloor', e.target.checked)}
                  className="h-4 w-4 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)] text-[color:var(--color-brand-500)] focus:ring-[color:var(--color-brand-500)]"
                />
                <div>
                  <span className="block text-sm font-semibold text-[color:var(--color-text-primary)]">
                    Per Floor
                  </span>
                  <span className="block text-xs text-[color:var(--color-text-muted)]">
                    One status per floor (vs. per room)
                  </span>
                </div>
              </label>
            </div>

            {/* Max per floor (only when isPerFloor) */}
            {formData.isPerFloor && (
              <Input
                label="Max Per Floor"
                type="number"
                value={formData.maxPerFloor ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                  updateField('maxPerFloor', val as number | undefined);
                }}
                placeholder="Leave empty for no limit"
                min={0}
                max={10}
              />
            )}

            {/* Complaint categories */}
            <div>
              <label className="font-[family:var(--font-body)] mb-1.5 block text-sm font-semibold text-[color:var(--color-text-primary)]">
                Applicable Complaint Categories
              </label>
              <Input
                value={(formData.applicableComplaintCategories ?? []).join(', ')}
                onChange={(e) => {
                  const cats = e.target.value
                    .split(',')
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean);
                  updateField('applicableComplaintCategories', cats.length > 0 ? cats : undefined);
                }}
                placeholder="e.g. wifi, internet (comma-separated)"
              />
              <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                Complaints with these categories will be linked to this amenity status
              </p>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} size="sm">
                <Save className="h-4 w-4" />
                {isAdding ? 'Add Amenity' : 'Save Changes'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {definitions.length === 0 && !isEditing ? (
        <div className="rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-10 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] text-[color:var(--color-text-muted)]">
            <Wrench className="h-8 w-8" />
          </div>
          <p className="font-[family:var(--font-display)] text-sm font-bold text-[color:var(--color-text-muted)]">
            No amenity types defined
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            Add your first amenity type to start managing services dynamically.
          </p>
          <Button onClick={handleStartAdd} size="sm" className="mt-4">
            <Plus className="h-4 w-4" />
            Add First Amenity
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] shadow-[var(--shadow-card)]">
          <table className="w-full">
            <thead>
              <tr className="border-b-[length:var(--bw-default)] border-b-[color:var(--border-color)] bg-[color:var(--color-surface-50)]">
                <th className="font-[family:var(--font-display)] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                  Amenity
                </th>
                <th className="font-[family:var(--font-display)] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                  Category
                </th>
                <th className="font-[family:var(--font-display)] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                  Status Label
                </th>
                <th className="font-[family:var(--font-display)] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                  Per Floor
                </th>
                <th className="font-[family:var(--font-display)] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                  Max/Floor
                </th>
                <th className="font-[family:var(--font-display)] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                  Complaint Categories
                </th>
                <th className="font-[family:var(--font-display)] px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {definitions.map((def, index) => (
                <tr
                  key={def.key}
                  className={`border-b-[length:var(--bw-default)] border-b-[color:var(--border-color)] transition-colors hover:bg-[color:var(--color-surface-50)] ${
                    editingIndex === index ? 'bg-[color:var(--color-brand-50)]' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex-shrink-0 text-[color:var(--color-text-muted)]">
                        {getIconComponent(def.icon)}
                      </span>
                      <div>
                        <span className="block text-sm font-semibold text-[color:var(--color-text-primary)]">
                          {def.label}
                        </span>
                        <span className="block font-mono text-[10px] text-[color:var(--color-text-muted)]">
                          {def.key}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-[family:var(--font-display)] inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${getCategoryBadge(def.category)}`}
                    >
                      {CATEGORY_OPTIONS.find((c) => c.value === def.category)?.label ??
                        def.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                        def.showAsStatusLabel
                          ? 'bg-[color:var(--color-success-100)] text-[color:var(--color-success-600)]'
                          : 'bg-[color:var(--color-card-bg)] text-[color:var(--color-surface-400)]'
                      }`}
                    >
                      {def.showAsStatusLabel ? '✓' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                        def.isPerFloor
                          ? 'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-600)]'
                          : 'bg-[color:var(--color-card-bg)] text-[color:var(--color-surface-400)]'
                      }`}
                    >
                      {def.isPerFloor ? '✓' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-semibold text-[color:var(--color-text-secondary)]">
                      {def.isPerFloor ? (def.maxPerFloor ?? '∞') : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(def.applicableComplaintCategories ?? []).length === 0 ? (
                        <span className="text-xs text-[color:var(--color-text-muted)]">—</span>
                      ) : (
                        (def.applicableComplaintCategories ?? []).map((cat) => (
                          <span
                            key={cat}
                            className="inline-flex items-center rounded-full border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-2 py-0.5 font-mono text-[9px] font-semibold text-[color:var(--color-surface-600)]"
                          >
                            {cat}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleStartEdit(index)}
                        className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-brand-600)] transition-colors hover:bg-[color:var(--color-brand-50)]"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setDeleteIndex(index)}
                        className="inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold text-[color:var(--color-danger-600)] transition-colors hover:bg-[color:var(--color-danger-50)]"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      <ConfirmModal
        open={deleteIndex !== null}
        title="Delete Amenity Type"
        message={
          deleteIndex !== null
            ? `Are you sure you want to delete "${definitions[deleteIndex]?.label}"? Any service status entries using this amenity type will remain but may show as unrecognized.`
            : ''
        }
        loading={false}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteIndex(null)}
      />
    </div>
  );
}
