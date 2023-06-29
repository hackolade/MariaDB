const {AlterScriptDto} = require('../types/AlterScriptDto');
const {getModifyProcedureScriptDtos} = require("./alterProcedureHelper");
const {getModifyUdfsScriptDtos} = require("./alterUdfHelper");
const {getModifyCollationScriptDto} = require("./containerHelpers/alterCollationHelper");
const {getModifySchemaCommentsScriptDtos} = require("./containerHelpers/commentsHelper");

module.exports = app => {
    const _ = app.require('lodash');
    const {
        wrapDbName,
    } = require('../../utils/general')({_});
    const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
    const {getDbData} = app.require('@hackolade/ddl-fe-utils').general;

    /**
     * @param containerData {Object}
     * @return {AlterScriptDto}
     * */
    const getAddContainerScriptDto = containerData => {
        const constructedDbData = getDbData([containerData]);
        const dbData = ddlProvider.hydrateDatabase(constructedDbData, {
            udfs: containerData.role?.UDFs,
            procedures: containerData.role?.Procedures,
            useDb: false
        });

        const script = _.trim(ddlProvider.createDatabase(dbData));
        return AlterScriptDto.getInstance([script], true, false);
    };

    /**
     * @param containerName {string}
     * @return {AlterScriptDto}
     * */
    const getDeleteContainerScriptDto = containerName => {
        const ddlDbName = wrapDbName(containerName);
        const script = ddlProvider.dropDatabase(ddlDbName);
        return AlterScriptDto.getInstance([script], true, true);
    };

    /**
     * @param containerData {Object}
     * @return {AlterScriptDto[]}
     * */
    const getModifyContainerScriptDtos = containerData => {
        const modifyCollationScript = getModifyCollationScriptDto(_, ddlProvider)(containerData);
        const modifyProceduresScriptDtos = getModifyProcedureScriptDtos(_, ddlProvider)(containerData);
        const modifyUdfsScriptDtos = getModifyUdfsScriptDtos(_, ddlProvider)(containerData);
        const modifyCommentsScriptDtos = getModifySchemaCommentsScriptDtos(_, ddlProvider)(containerData);

        return [
            modifyCollationScript,
            ...modifyUdfsScriptDtos,
            ...modifyProceduresScriptDtos,
            ...modifyCommentsScriptDtos,
        ]
            .filter(Boolean);
    };


    return {
        getAddContainerScriptDto,
        getDeleteContainerScriptDto,
        getModifyContainerScriptDtos,
    };
};
