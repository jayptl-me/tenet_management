'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueries, type QueryKey } from '@tanstack/react-query';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import type { FormPageProps } from '@/components/ui/FormPage';
import type { FormCardProps } from '@/components/ui/FormCard';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useUnsavedGuard, useUnsavedGuardState } from '@/hooks/useUnsavedGuard';
import { ApiQueryError, errorMessage, queryData } from '@/lib/query';
import { parseApiError } from '@/lib/errorParser';

export type CrudMode = 'create' | 'edit';

/** One declared read the shell must complete before the form is interactive. */
export interface CrudLoad<TEntity = unknown, TValues extends FieldValues = FieldValues> {
  /** Cache identity, same rule as useApiQuery: every input that changes the response. */
  queryKey: QueryKey;
  /** Path relative to the admin API base, e.g. `laundry-slots/${id}`. */
  path: string;
  /**
   * Entity -> form values. The shell feeds the result to form.reset().
   * Declared as a method so page-level mappers with a narrower entity type are
   * assignable under strictFunctionTypes. Keep the reference stable
   * (module-level function or useMemo): the bridge effect depends on it.
   */
  mapToValues(entity: TEntity): TValues;
  /** Extra reads to await alongside the entity (e.g. app-config). */
  prefetch?: ReadonlyArray<{ queryKey: QueryKey; path: string }>;
}

export interface CrudSubmitArgs<TValues extends FieldValues> {
  values: TValues; // already validated by the page's zodResolver
  mode: CrudMode;
}

export interface CrudSubmitResult {
  /**
   * - string: shell navigates here after the write
   * - undefined: shell uses the `redirectTo` prop
   * - null: page owns navigation (post-create dialog flows)
   */
  redirectTo?: string | null;
  /** Non-fatal message to show above the form (e.g. "saved, image upload failed"). */
  notice?: string;
}

export interface CrudFormPageProps<TValues extends FieldValues = FieldValues> {
  // --- chrome (delegated to FormPage) ---
  title: string;
  description?: string;
  /** Back button + Cancel target. List route on create, detail or list on edit. */
  backHref: string;
  maxWidth?: FormPageProps['maxWidth']; // default '2xl', matching FormPage
  headerActions?: ReactNode;
  headerBadge?: ReactNode;

  // --- form ownership stays in the page ---
  form: UseFormReturn<TValues>;

  // --- lifecycle ---
  mode: CrudMode;
  /** Required when mode === 'edit'; omit for create. */
  load?: CrudLoad<unknown, TValues>;
  /** Page-owned write. Payload shaping, extra GETs and multi-step writes live here. */
  submit: (args: CrudSubmitArgs<TValues>) => Promise<CrudSubmitResult | void>;
  /** Landing route: create default, and edit default when submit returns nothing. */
  redirectTo: string;
  submitLabel?: string; // default 'Save Changes'
  /** Default true on edit pages, false on create pages. */
  dirtyGuard?: boolean;

  // --- divergence slots ---
  /** Rendered between the header and the card (context panels, lock banners). */
  preflight?: ReactNode;
  /** Left of Cancel/Save (retire, approve, reject). */
  footerLeading?: ReactNode;
  /** Full footer replacement; receives nothing, caller wires form.handleSubmit itself. */
  footer?: ReactNode;
  card?: Pick<FormCardProps, 'title' | 'description' | 'className' | 'id'>;
  /** Render instead of the default ErrorBanner when the load fails. */
  loadErrorFallback?: ReactNode;

  children: ReactNode; // FormSections etc., built in page scope with register/control
  className?: string;
}

/** Disabled queries still need a key; nothing ever fetches under this one. */
const NO_LOAD_KEY: QueryKey = ['crud-form-page', 'no-load'];

/**
 * Submit failures become one display string: ApiQueryError already carries a
 * display-ready message (do not re-parse); anything else goes through
 * parseApiError, which also passes plain Error messages straight through.
 */
async function submitErrorMessage(err: unknown): Promise<string> {
  if (err instanceof ApiQueryError) return err.message;
  return (await parseApiError(err)).message;
}

/**
 * CrudFormPage - lifecycle shell over the existing FormPage + FormCard +
 * FormActions (never re-renders their markup). See sections 5 and 6.2 of
 * docs/plans/crud-form-page-design.md.
 *
 * It owns: the entity load (useApiQuery + one bridge effect into
 * form.reset), submitError state, FormCard onSubmit via form.handleSubmit,
 * the redirect contract, and the dirty guard. The page owns: the zod schema,
 * useForm, field markup, payload shaping, and every extra read it performs
 * itself.
 *
 * This component HAS consumers (laundry and washing-machines new/edit pages,
 * with further waves queued in the design doc). PageShell.tsx was deleted for
 * having zero importers - do not treat this file as an orphan candidate
 * without re-checking the adoption list first.
 */
export function CrudFormPage<TValues extends FieldValues = FieldValues>({
  title,
  description,
  backHref,
  maxWidth,
  headerActions,
  headerBadge,
  form,
  mode,
  load,
  submit,
  redirectTo,
  submitLabel = 'Save Changes',
  dirtyGuard,
  preflight,
  footerLeading,
  footer,
  card,
  loadErrorFallback,
  className,
  children,
}: CrudFormPageProps<TValues>) {
  const router = useRouter();
  const { reset, formState } = form;
  const { isDirty, isSubmitting } = formState;
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState('');

  // Load through the shared query layer: retry policy and ApiQueryError come
  // from lib/query. A page may observe the same queryKey itself for preflight
  // data; both observers share one cache entry and one request.
  const loadQuery = useApiQuery<unknown>(load?.queryKey ?? NO_LOAD_KEY, load?.path ?? '', {
    enabled: load != null,
  });

  const prefetchQueries = useQueries({
    queries: (load?.prefetch ?? []).map((entry) => ({
      queryKey: entry.queryKey,
      queryFn: () => queryData(entry.path),
    })),
  });

  // The single bridge effect the shell keeps: query cache -> form state.
  // RHF warns against depending on the whole useForm() return value, so only
  // the destructured `reset` is a dependency.
  const mapToValues = load?.mapToValues;
  const entity = loadQuery.data;
  useEffect(() => {
    if (!mapToValues || entity == null) return;
    reset(mapToValues(entity));
  }, [entity, reset, mapToValues]);

  // Keep the skeleton up until the network settles so fields never flash
  // empty (same UX as the hand-rolled edit effects this replaces).
  const isLoading =
    (load != null && loadQuery.isFetching) || prefetchQueries.some((query) => query.isFetching);
  const loadFailed = load != null && loadQuery.isError;
  const loadOk = load == null || loadQuery.isSuccess;
  const submitDisabled = !loadOk;

  // Section 5.4: default on for edit, armed only after the load resolves so
  // an untouched form never reads as dirty against empty defaults.
  const guardArmed = (dirtyGuard ?? mode === 'edit') && loadOk;
  const guardDirty = guardArmed && isDirty;
  useUnsavedGuard(guardDirty);
  const guard = useUnsavedGuardState(guardDirty);

  const onValidSubmit = form.handleSubmit(async (values) => {
    setSubmitError('');
    setNotice('');
    try {
      const result = await submit({ values, mode });
      // Redirect contract: string wins, undefined falls back to the prop,
      // null means the page owns navigation.
      const target =
        result != null && result.redirectTo !== undefined ? result.redirectTo : redirectTo;
      if (result?.notice) setNotice(result.notice);
      if (target !== null) router.push(target);
    } catch (err) {
      setSubmitError(await submitErrorMessage(err));
    }
  });

  // Section 5.5: one banner channel, submit error first (it is cleared at
  // submit start), load error behind any loadErrorFallback override.
  const loadErrorMessage = loadFailed && !loadErrorFallback ? errorMessage(loadQuery.error) : '';
  const error = submitError || loadErrorMessage;

  const cardNode = (
    <FormCard
      onSubmit={onValidSubmit}
      title={card?.title}
      description={card?.description}
      className={card?.className}
      id={card?.id}
      footer={
        footer ?? (
          <FormActions
            loading={isSubmitting}
            disabled={submitDisabled}
            submitLabel={submitLabel}
            cancelHref={backHref}
            onCancel={guardArmed ? () => guard.requestLeave(backHref) : undefined}
            leading={footerLeading}
            divided={false}
          />
        )
      }
    >
      {children}
    </FormCard>
  );

  return (
    <>
      <FormPage
        title={title}
        description={description}
        backHref={backHref}
        error={error}
        isLoading={isLoading}
        actions={headerActions}
        badge={headerBadge}
        maxWidth={maxWidth}
        className={className}
      >
        {loadFailed && loadErrorFallback}
        {notice && <ErrorBanner message={notice} variant="info" />}
        {preflight ? (
          <div className="space-y-5">
            {preflight}
            {cardNode}
          </div>
        ) : (
          cardNode
        )}
      </FormPage>

      <ConfirmModal
        open={guard.guardOpen}
        variant="warning"
        title="Leave with unsaved changes?"
        message="Your edits will be lost if you leave now."
        confirmLabel="Leave anyway"
        cancelLabel="Keep editing"
        onConfirm={guard.confirmLeave}
        onCancel={guard.cancelLeave}
      />
    </>
  );
}
