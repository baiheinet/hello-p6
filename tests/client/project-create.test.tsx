// The project create dialog against the real page: the dialog's create button sits in the overlay's footer,
// outside the form, and is associated with it by `form`. Clicking it must run the save through `FeedbackForm`'s
// `onSubmit`, so the route overlay's "Discard changes?" guard sees the save running while the close and the
// navigation a successful create starts, and still asks when the form is genuinely dirty or the save failed.
import {
  answerApi,
  renderWithApp,
  type ApiCall,
} from '@nocobase/app-testing/client';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import enUS from '../../client/locales/en-US.js';
import packageMetadata from '../../package.json' with { type: 'json' };

// The app renders this dialog page inside the route's own overlay host, so the page's `useRouteOverlay` and the
// footer it configures come from the host, exactly as the dialog presentation does.
const { RouteOverlayHost } =
  await import('../../client/components/route-overlay.js');

vi.mock('../../client/components/date-picker', () => ({
  // A plain date input stands in for the popover picker: the create flow's guard behavior does not depend on it.
  DatePicker({
    id,
    onChange,
  }: {
    readonly id?: string;
    readonly value: Date | undefined;
    readonly onChange: (date: Date | undefined) => void;
  }): ReactElement {
    return (
      <input
        type='text'
        aria-label={id === 'rp-start' ? 'Start date' : 'End date'}
        defaultValue=''
        onChange={(event) =>
          onChange(
            /^\d{4}-\d{2}-\d{2}$/.test(event.target.value)
              ? new Date(
                  Number(event.target.value.slice(0, 4)),
                  Number(event.target.value.slice(5, 7)) - 1,
                  Number(event.target.value.slice(8, 10)),
                )
              : undefined,
          )
        }
      />
    );
  },
}));

const { default: NewProjectPage } =
  await import('../../client/pages/resource-projects/new.js');

let createdRecord: Record<string, unknown> | Response;

const api = vi.fn(({ method, path, json }: ApiCall) => {
  if (method === 'POST' && path === 'resourceProjects') {
    if (createdRecord instanceof Response) return createdRecord;
    return { data: { id: '7', ...json } };
  }
  return new Response(null, { status: 404 });
});

function LocationProbe(): ReactElement {
  const { pathname } = useLocation();
  return <span data-testid='location'>{pathname}</span>;
}

async function renderNewDialog() {
  return renderWithApp(
    <>
      <LocationProbe />
      <Routes>
        <Route path='/resource-projects' element={<Outlet />}>
          {/* The app renders the overlay host inside the dialog route's element (client-route.tsx), so relative
              navigation from the panel resolves within the route tree the same way. */}
          <Route
            path='new'
            element={
              <RouteOverlayHost title='New project' ready>
                <NewProjectPage />
              </RouteOverlayHost>
            }
          />
          <Route path=':projectId' element={<p>Project detail</p>} />
        </Route>
      </Routes>
    </>,
    {
      route: '/resource-projects/new',
      namespace: packageMetadata.name,
      namespaces: { [packageMetadata.name]: enUS },
      fetch: answerApi(api),
    },
  );
}

async function fill(): Promise<void> {
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Project name' }),
    'Alpha',
  );
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Total quantity' }),
    '10',
  );
  await userEvent.type(screen.getByRole('textbox', { name: 'Periods' }), '2');
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Start date' }),
    '2026-11-01',
  );
  await userEvent.type(
    screen.getByRole('textbox', { name: 'End date' }),
    '2026-11-20',
  );
}

describe('the project create dialog', () => {
  beforeEach(() => {
    api.mockClear();
    createdRecord = {};
  });

  it('closes and opens the new project without asking to discard after a successful create', async () => {
    await renderNewDialog();
    await fill();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Create' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/resource-projects/7',
      ),
    );
    // The navigation the save started has finished; no "Discard changes?" question opened over it, and the dialog
    // is gone.
    expect(
      api.mock.calls.some(
        ([call]) => call.method === 'POST' && call.path === 'resourceProjects',
      ),
    ).toBe(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'New project' }),
    ).not.toBeInTheDocument();
  });

  it('still asks to discard when the filled form is cancelled without saving', async () => {
    await renderNewDialog();
    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Project name' }),
      'Alpha',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const prompt = await screen.findByRole('alertdialog', {
      name: 'Discard changes?',
    });
    await userEvent.click(
      within(prompt).getByRole('button', { name: 'Keep editing' }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/resource-projects/new',
      ),
    );
    // The overlay kept the input while the question was open.
    expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue(
      'Alpha',
    );
  });

  it('reports a failed create in the form and still asks to discard on Cancel', async () => {
    createdRecord = new Response(null, { status: 500 });
    await renderNewDialog();
    await fill();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Create' }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Unable to save. Your input has been kept. Try again.',
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/resource-projects/new',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const prompt = await screen.findByRole('alertdialog', {
      name: 'Discard changes?',
    });
    await userEvent.click(
      within(prompt).getByRole('button', { name: 'Keep editing' }),
    );
    expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue(
      'Alpha',
    );
  });
});
