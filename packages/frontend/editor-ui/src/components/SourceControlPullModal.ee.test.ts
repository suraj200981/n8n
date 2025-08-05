import SourceControlPullModalEe from './SourceControlPullModal.ee.vue';
import { createComponentRenderer } from '@/__tests__/render';
import { createTestingPinia } from '@pinia/testing';
import { createEventBus } from '@n8n/utils/event-bus';
import userEvent from '@testing-library/user-event';
import { useSourceControlStore } from '@/stores/sourceControl.store';
import { mockedStore } from '@/__tests__/utils';
import { waitFor } from '@testing-library/dom';

vi.mock('vue-router', () => ({
	useRoute: vi.fn().mockReturnValue({
		name: vi.fn(),
		params: vi.fn(),
		fullPath: vi.fn(),
	}),
	RouterLink: vi.fn(),
	useRouter: vi.fn().mockReturnValue({
		back: vi.fn(),
		push: vi.fn(),
		replace: vi.fn(),
	}),
}));

vi.mock('@/composables/useLoadingService', () => ({
	useLoadingService: () => ({
		startLoading: vi.fn(),
		stopLoading: vi.fn(),
		setLoadingText: vi.fn(),
	}),
}));

vi.mock('@/composables/useToast', () => ({
	useToast: () => ({
		showMessage: vi.fn(),
		showError: vi.fn(),
	}),
}));

const eventBus = createEventBus();

const DynamicScrollerStub = {
	props: {
		items: Array,
		minItemSize: Number,
		itemClass: String,
	},
	template: '<div><template v-for="item in items"><slot v-bind="{ item }"></slot></template></div>',
	methods: {
		scrollToItem: vi.fn(),
	},
};

const DynamicScrollerItemStub = {
	props: {
		item: Object,
		active: Boolean,
		sizeDependencies: Array,
		dataIndex: Number,
	},
	template: '<slot></slot>',
};

const renderModal = createComponentRenderer(SourceControlPullModalEe, {
	global: {
		stubs: {
			DynamicScroller: DynamicScrollerStub,
			DynamicScrollerItem: DynamicScrollerItemStub,
			Modal: {
				template: `
					<div>
						<slot name="header" />
						<slot name="title" />
						<slot name="content" />
						<slot name="footer" />
					</div>
				`,
			},
			'router-link': {
				template: '<a><slot /></a>',
				props: ['to'],
			},
		},
	},
});

const sampleFiles = [
	{
		id: '014da93897f146d2b880-baa374b9d02d',
		name: 'vuelfow2',
		type: 'workflow',
		status: 'created',
		location: 'remote',
		conflict: false,
		file: '/014da93897f146d2b880-baa374b9d02d.json',
		updatedAt: '2025-01-09T13:12:24.580Z',
	},
	{
		id: 'a102c0b9-28ac-43cb-950e-195723a56d54',
		name: 'Gmail account',
		type: 'credential',
		status: 'created',
		location: 'remote',
		conflict: false,
		file: '/a102c0b9-28ac-43cb-950e-195723a56d54.json',
		updatedAt: '2025-01-09T13:12:24.586Z',
	},
];

describe('SourceControlPullModal', () => {
	let sourceControlStore: ReturnType<typeof mockedStore<typeof useSourceControlStore>>;
	let pinia: ReturnType<typeof createTestingPinia>;

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup store with default mock to prevent automatic data loading
		pinia = createTestingPinia();
		sourceControlStore = mockedStore(useSourceControlStore);
		sourceControlStore.getAggregatedStatus = vi.fn().mockResolvedValue([]);
		sourceControlStore.pullWorkfolder = vi.fn().mockResolvedValue([]);
	});

	it('mounts', () => {
		const { getByText } = renderModal({
			pinia,
			props: {
				data: {
					eventBus,
					status: [], // Provide initial status to prevent auto-loading
				},
			},
		});
		expect(getByText('Pull and override')).toBeInTheDocument();
	});

	it('should renders the changes', () => {
		const { getAllByTestId } = renderModal({
			pinia,
			props: {
				data: {
					eventBus,
					status: sampleFiles,
				},
			},
		});

		expect(getAllByTestId('pull-modal-item-header').length).toBe(2);
		expect(getAllByTestId('pull-modal-item').length).toBe(2);
	});

	it('should force pull', async () => {
		// Use the existing store instance from beforeEach
		const { getByTestId } = renderModal({
			pinia,
			props: {
				data: {
					eventBus,
					status: sampleFiles,
				},
			},
		});

		await userEvent.click(getByTestId('force-pull'));

		await waitFor(() => expect(sourceControlStore.pullWorkfolder).toHaveBeenCalledWith(true));
	});
});
