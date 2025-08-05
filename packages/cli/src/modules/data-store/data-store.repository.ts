import type { DataStoreCreateColumnSchema, ListDataStoreQueryDto } from '@n8n/api-types';
import { Service } from '@n8n/di';
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from '@n8n/typeorm';

import { DataStoreEntity } from './data-store.entity';
import { createUserTableQuery, toTableName } from './utils/sql-utils';

@Service()
export class DataStoreRepository extends Repository<DataStoreEntity> {
	constructor(dataSource: DataSource) {
		super(DataStoreEntity, dataSource.manager);
	}

	async createUserTable(projectId: string, name: string, columns: DataStoreCreateColumnSchema[]) {
		return await this.manager.transaction(async (em) => {
			const dataStore = em.create(DataStoreEntity, { name, columns, projectId });
			await this.insert(dataStore);
			const dbType = this.manager.connection.options.type;
			await this.manager.query(createUserTableQuery(toTableName(dataStore.id), columns, dbType));
			return dataStore;
		});
	}

	async deleteUserTable(dataStoreId: string, entityManager?: EntityManager) {
		const executor = entityManager ?? this.manager;
		return await executor.transaction(async (em) => {
			await em.delete(DataStoreEntity, { id: dataStoreId });
			await em.query(`DROP TABLE ${toTableName(dataStoreId)}`);

			return true;
		});
	}

	async deleteDataStoreByProjectId(projectId: string) {
		return await this.manager.transaction(async (em) => {
			const existingTables = await em.findBy(DataStoreEntity, { projectId });

			let changed = false;
			for (const match of existingTables) {
				const result = await this.deleteUserTable(match.id, em);
				changed = changed || result;
			}

			return changed;
		});
	}

	async deleteDataStoreAll() {
		return await this.manager.transaction(async (em) => {
			const existingTables = await em.findBy(DataStoreEntity, {});

			let changed = false;
			for (const match of existingTables) {
				const result = await this.deleteUserTable(match.id, em);
				changed = changed || result;
			}

			return changed;
		});
	}

	async getManyAndCount(options: Partial<ListDataStoreQueryDto>) {
		const query = this.getManyQuery(options);
		const [data, count] = await query.getManyAndCount();
		return { count, data };
	}

	async getMany(options: Partial<ListDataStoreQueryDto>) {
		const query = this.getManyQuery(options);
		return await query.getMany();
	}

	private getManyQuery(
		options: Partial<ListDataStoreQueryDto>,
	): SelectQueryBuilder<DataStoreEntity> {
		const query = this.createQueryBuilder('dataStore');

		this.applySelections(query);
		this.applyFilters(query, options.filter);
		this.applySorting(query, options.sortBy);
		this.applyPagination(query, options);

		return query;
	}

	private applySelections(query: SelectQueryBuilder<DataStoreEntity>): void {
		this.applyDefaultSelect(query);
	}

	private applyFilters(
		query: SelectQueryBuilder<DataStoreEntity>,
		filter: Partial<ListDataStoreQueryDto>['filter'],
	): void {
		for (const x of ['id', 'projectId'] as const) {
			const content = [filter?.[x]].flat().filter((x) => x !== undefined);
			if (content.length === 0) continue;

			query.andWhere(`dataStore.${x} IN (:...${x}s)`, {
				/*
				 * If list is empty, add a dummy value to prevent an error
				 * when using the IN operator with an empty array.
				 */
				[x + 's']: content.length > 0 ? content : [''],
			});
		}

		if (filter?.name && typeof filter.name === 'string') {
			query.andWhere('LOWER(dataStore.name) LIKE LOWER(:name)', {
				name: `%${filter.name}%`,
			});
		}
	}

	private applySorting(query: SelectQueryBuilder<DataStoreEntity>, sortBy?: string): void {
		if (!sortBy) {
			query.orderBy('dataStore.updatedAt', 'DESC');
			return;
		}

		const [field, order] = this.parseSortingParams(sortBy);
		this.applySortingByField(query, field, order);
	}

	private parseSortingParams(sortBy: string): [string, 'DESC' | 'ASC'] {
		const [field, order] = sortBy.split(':');
		return [field, order?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'];
	}

	private applySortingByField(
		query: SelectQueryBuilder<DataStoreEntity>,
		field: string,
		direction: 'DESC' | 'ASC',
	): void {
		if (field === 'name') {
			query
				.addSelect('LOWER(dataStore.name)', 'dataStore_name_lower')
				.orderBy('dataStore_name_lower', direction);
		} else if (['createdAt', 'updatedAt'].includes(field)) {
			query.orderBy(`dataStore.${field}`, direction);
		}
	}

	private applyPagination(
		query: SelectQueryBuilder<DataStoreEntity>,
		options: Partial<ListDataStoreQueryDto>,
	): void {
		query.skip(options.skip ?? 0);
		query.take(options.take ?? 0);
	}

	private applyDefaultSelect(query: SelectQueryBuilder<DataStoreEntity>): void {
		query
			.leftJoinAndSelect('dataStore.project', 'project')
			.leftJoinAndSelect('dataStore.columns', 'data_store_column_entity')
			.select([
				'dataStore',
				...this.getDataStoreColumnFields('data_store_column_entity'),
				...this.getProjectFields('project'),
			]);
	}

	private getDataStoreColumnFields(alias: string): string[] {
		return [`${alias}.id`, `${alias}.name`, `${alias}.type`];
	}

	private getProjectFields(alias: string): string[] {
		return [`${alias}.id`, `${alias}.name`, `${alias}.type`, `${alias}.icon`];
	}
}
