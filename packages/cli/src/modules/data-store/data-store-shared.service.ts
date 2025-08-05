import type { ListDataStoreQueryDto } from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import { User } from '@n8n/db';
import { Service } from '@n8n/di';

import { DataStoreRepository } from './data-store.repository';
import { ProjectService } from '@/services/project.service.ee';

@Service()
export class DataStoreSharedService {
	constructor(
		private readonly dataStoreRepository: DataStoreRepository,
		private readonly projectService: ProjectService,
		private readonly logger: Logger,
	) {
		this.logger = this.logger.scoped('data-store');
	}
	async start() {}
	async shutdown() {}

	async getManyAndCount(user: User, options: ListDataStoreQueryDto) {
		const projects = await this.projectService.getProjectRelationsForUser(user);
		let projectIds = projects.map((x) => x.projectId);
		if (options.filter?.projectId) {
			const mask = [options.filter?.projectId].flat();
			projectIds = projectIds.filter(mask.includes);
		}
		return await this.dataStoreRepository.getManyAndCount({
			...options,
			filter: {
				...options.filter,
				projectId: projectIds,
			},
		});
	}
}
