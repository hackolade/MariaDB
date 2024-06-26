const TableOptions = Object.freeze({
	ENGINE: 'ENGINE',
	AUTO_INCREMENT: 'AUTO_INCREMENT',
	AVG_ROW_LENGTH: 'AVG_ROW_LENGTH',
	CHECKSUM: 'CHECKSUM',
	DATA_DIRECTORY: 'DATA DIRECTORY',
	DELAY_KEY_WRITE: 'DELAY_KEY_WRITE',
	INDEX_DIRECTORY: 'INDEX DIRECTORY',
	ENCRYPTED: 'ENCRYPTED',
	ENCRYPTION_KEY_ID: 'ENCRYPTION_KEY_ID',
	IETF_QUOTES: 'IETF_QUOTES',
	INSERT_METHOD: 'INSERT_METHOD',
	UNION: 'UNION',
	KEY_BLOCK_SIZE: 'KEY_BLOCK_SIZE',
	MIN_ROWS: 'MIN_ROWS',
	MAX_ROWS: 'MAX_ROWS',
	PACK_KEYS: 'PACK_KEYS',
	PAGE_CHECKSUM: 'PAGE_CHECKSUM',
	PAGE_COMPRESSED: 'PAGE_COMPRESSED',
	PAGE_COMPRESSION_LEVEL: 'PAGE_COMPRESSION_LEVEL',
	ROW_FORMAT: 'ROW_FORMAT',
	SEQUENCE: 'SEQUENCE',
	STATS_AUTO_RECALC: 'STATS_AUTO_RECALC',
	STATS_PERSISTENT: 'STATS_PERSISTENT',
	TRANSACTIONAL: 'TRANSACTIONAL',
	WITH_SYSTEM_VERSIONING: 'WITH SYSTEM VERSIONING',
});

const TableOptionsByEngine = Object.freeze({
	MyISAM: [
		'AUTO_INCREMENT',
		'AVG_ROW_LENGTH',
		'CHECKSUM',
		'DATA_DIRECTORY',
		'DELAY_KEY_WRITE',
		'INDEX_DIRECTORY',
		'KEY_BLOCK_SIZE',
		'PACK_KEYS',
		'ROW_FORMAT',
		'WITH_SYSTEM_VERSIONING',
	],
	InnoDB: [
		'AUTO_INCREMENT',
		'DATA_DIRECTORY',
		'INDEX_DIRECTORY',
		'ENCRYPTED',
		'ENCRYPTION_KEY_ID',
		'KEY_BLOCK_SIZE',
		'PACK_KEYS',
		'PAGE_COMPRESSED',
		'PAGE_COMPRESSION_LEVEL',
		'ROW_FORMAT',
		'SEQUENCE',
		'STATS_AUTO_RECALC',
		'STATS_PERSISTENT',
		'WITH_SYSTEM_VERSIONING',
	],
	CSV: ['IETF_QUOTES', 'KEY_BLOCK_SIZE', 'PACK_KEYS', 'WITH_SYSTEM_VERSIONING'],
	MERGE: ['INSERT_METHOD', 'UNION', 'KEY_BLOCK_SIZE', 'PACK_KEYS', 'WITH_SYSTEM_VERSIONING'],
	Aria: [
		'AUTO_INCREMENT',
		'AVG_ROW_LENGTH',
		'CHECKSUM',
		'DATA_DIRECTORY',
		'DELAY_KEY_WRITE',
		'INDEX_DIRECTORY',
		'PAGE_CHECKSUM',
		'ROW_FORMAT',
		'KEY_BLOCK_SIZE',
		'PACK_KEYS',
		'TRANSACTIONAL',
		'WITH_SYSTEM_VERSIONING',
	],
	Memory: ['AUTO_INCREMENT', 'KEY_BLOCK_SIZE', 'PACK_KEYS', 'WITH_SYSTEM_VERSIONING'],
	Archive: ['AUTO_INCREMENT', 'KEY_BLOCK_SIZE', 'PACK_KEYS', 'WITH_SYSTEM_VERSIONING'],
});

module.exports = {
	TableOptions,
	TableOptionsByEngine,
};
