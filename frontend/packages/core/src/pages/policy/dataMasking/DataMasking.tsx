import { ActionType } from "@ant-design/pro-components";
import { useMemo, useRef, useState } from "react";
import { Button, message, Switch } from 'antd'
import PageList, { PageProColumns } from "@common/components/aoplatform/PageList";
import { $t } from "@common/locales";
import { useGlobalContext } from "@common/contexts/GlobalStateContext";
import { BasicResponse, RESPONSE_TIPS, STATUS_CODE } from "@common/const/const.tsx";
import { useFetch } from "@common/hooks/http";
import WithPermission from "@common/components/aoplatform/WithPermission.tsx";
import TableBtnWithPermission from "@common/components/aoplatform/TableBtnWithPermission";
import { DATA_MASSKING_TABLE_COLUMNS } from "./DataMaskingColumn";
import { useNavigate, useParams } from "react-router-dom";
import { PolicyPublishInfoType, PolicyPublishModalHandle, RouterParams } from "@common/const/type";
import { DrawerWithFooter } from "@common/components/aoplatform/DrawerWithFooter";
import { DataMaskStrategyItem } from "@common/const/policy/type";
import {PolicyPublishModalContent} from '@common/components/aoplatform/PolicyPublishModalContent'

const DataMasking = (props: any) => {

  const {
    // 是否显示发布按钮
    publishBtn = false,
    // 行操作
    rowOperation = []
  } = props;
  const { serviceId, teamId } = useParams<RouterParams>()
  const { state } = useGlobalContext()
  const navigator = useNavigate()
  const [drawerVisible, setDrawerVisible] = useState<boolean>(false)
  const [drawerData, setDrawerData] = useState<PolicyPublishInfoType >()
  const [isOkToPublish, setIsOkToPublish] = useState<boolean>(false)
  const drawerRef = useRef<PolicyPublishModalHandle>(null)
    /**
   * 列表ref
   */
  const pageListRef = useRef<ActionType>(null);
  
  /**
   * 请求数据
   */
  const { fetchData } = useFetch()

  /**
   * 搜索关键字
   */
  const [searchWord, setSearchWord] = useState<string>('')

  /**
   * 获取列数据，国际化变化时重新获取
   */
  const columns = useMemo(() => {
    const res = DATA_MASSKING_TABLE_COLUMNS.map(x => {
      // 启动列渲染
      if (x.dataIndex === 'isStop') {
        x.render = (text: any, record: any) => <Switch checked={!record.isStop} onChange={(e) => { changeOpenApiStatus(e, record) }} />
      }
      // 处理数列渲染
      if (x.dataIndex === 'treatmentNumber') {
        x.render = (text: any, record: any) => <span className="w-full block cursor-pointer [&>.ant-typography]:text-theme" onClick={(e) => { openLogsModal(record) }} >{ text }</span>
      }
      return {
        ...x,
        title: typeof x.title === 'string' ? $t(x.title as string) : x.title
      }
    })
    return res
  }, [ state.language])

  /**
   * 操作列
   */
  const operation: PageProColumns<any>[] = rowOperation.length ? [
    {
      title: '',
      key: 'option',
      btnNums: rowOperation.length,
      fixed: 'right',
      valueType: 'option',
      render: (_: React.ReactNode, entity: any) => [
        ...(rowOperation.length && rowOperation.find((item: string) => item === 'edit') ? [<TableBtnWithPermission access="system.organization.member.edit" key="edit" btnType="edit" onClick={() => { openEditModal(entity) }} btnTitle="编辑" />] : []),
        // ...(rowOperation.length && rowOperation.find((item: string) => item === 'logs') ? [<TableBtnWithPermission access="system.organization.member.edit" key="logs" btnType="logs" onClick={() => { openLogsModal(entity) }} btnTitle="详情" />] : []),
        ...(rowOperation.length && rowOperation.find((item: string) => item === 'delete') ? [
          entity.isDeleted ? <TableBtnWithPermission access="system.organization.member.edit" key="refresh" btnType="refresh" onClick={() => { restorePolicy(entity) }} btnTitle="恢复" /> : 
          <TableBtnWithPermission access="system.organization.member.edit" key="delete" btnType="delete" onClick={() => { deletePolicy(entity) }} btnTitle="删除" />
            ] : []),
      ],
    }
  ] : []

  /**
   * 手动刷新表格数据
   */
  const manualReloadTable = () => {
    pageListRef.current?.reload()
  };

  /**
   * 更改启动状态
   * @param enabled 状态
   * @param entity 行数据
   */
  const changeOpenApiStatus = (enabled: boolean, entity: any) => {
    fetchData<BasicResponse<null>>(
      `strategy/${serviceId === undefined? 'global':'service'}/data-masking/${enabled ? 'disable' : 'enable'}`,
      {
        method: 'PUT',
        eoParams: {
          service:serviceId,
          team:teamId,
          strategy: entity.id
        }
      }
    ).then(response => {
      const { code, msg } = response
      if (code === STATUS_CODE.SUCCESS) {
        message.success(msg || $t(RESPONSE_TIPS.success))
        manualReloadTable()
      } else {
        message.error(msg || $t(RESPONSE_TIPS.error))
      }
    })
  }

  /**
   * 获取列表数据
   * @param dataType 
   * @returns 
   */
  const getPolicyList = (params: DataMaskStrategyItem & {
    pageSize: number;
    current: number;
  },
  sort:Record<string, string>,
  filter:Record<string, string>) => {
    let filters
    if(filter){
      filters = []
      if(filter.isStop){
          if(filter.isStop.indexOf('true')!== -1){
              filters.push('enable')
          }
          if(filter.isStop.indexOf('false')!== -1){
              filters.push('disable')
          }
          if(filter.publishStatus?.length > 0){
            filters = [...filters, ...filter.publishStatus]
          }
      }
    }

    return fetchData<BasicResponse<{list:DataMaskStrategyItem[], total:number}>>(
      `strategy/${serviceId === undefined? 'global':'service'}/data-masking/list`,
      {
        method: 'GET',
        eoParams: { 
          order:Object.keys(sort)?.[0],
          sort:Object.keys(sort)?.length > 0 ? Object.values(sort)?.[0] === 'descend' ? 'desc' : 'asc' : undefined,
          filters:JSON.stringify(filters),
          keyword: searchWord,
          service:serviceId,
          team:teamId,},
        eoTransformKeys: ['is_stop', 'is_deleted', 'update_time','publish_status','processed_total']
      }
    ).then(response => {
      const { code,data, msg } = response
      if (code === STATUS_CODE.SUCCESS) {
        // 保存数据
        return {
          data:data.strategies,
          total:data.total,
          success: true
        }
      } else {
        message.error(msg || $t(RESPONSE_TIPS.error))
        return { data: [], success: false }
      }
    }).catch(() => {
      return { data: [], success: false }
    })

    
  }

  /**
   * 添加策略
   * @param type 
   */
  const addPolicy = () => {
    navigator('/globalpolicy/datamasking/create')
  }

  /**
   * 发布策略
   */
  const publish = async () => {
    message.loading($t(RESPONSE_TIPS.loading));
    const { code, data, msg } = await fetchData<BasicResponse<PolicyPublishInfoType>>(
        'strategy/global/data-masking/to-publishs',
        { method: 'GET',eoTransformKeys:['opt_time','is_publish','version_name','unpublish_msg'] }
    );
    message.destroy();
    if (code === STATUS_CODE.SUCCESS) {
        setDrawerVisible(true)
        setDrawerData(data)
        setIsOkToPublish(data.isPublish??true)
    } else {
        message.error(msg || $t(RESPONSE_TIPS.error));
        return
    }
  }

  /**
   * 编辑
   */
  const openEditModal = (entity: any) => {
    navigator(`/globalpolicy/datamasking/${entity.id}`)
  }

  /**
   * 日志
   * @param entity 
   */
  const openLogsModal = (entity: any) => {
    console.log('日志', entity);
  }

  /**
   * 删除
   * @param entity 
   */
  const deletePolicy = (entity: DataMaskStrategyItem) => {
    fetchData<BasicResponse<null>>(
      `strategy/${serviceId === undefined? 'global':'service'}/data-masking`,
      {
        method: 'DELETE',
        eoParams: { 
          service:serviceId,
          team:teamId,
          strategy:entity.id},
      }
    ).then(response => {
      const { code, msg } = response
      if (code === STATUS_CODE.SUCCESS) {
        message.success(msg || $t(RESPONSE_TIPS.success))
        manualReloadTable()
      } else {
        message.error(msg || $t(RESPONSE_TIPS.error))
      }
    })
  }

  /**
   * 恢复
   * @param entity 
   */
  const restorePolicy = (entity: any) => {
    fetchData<BasicResponse<null>>(
      `strategy/${serviceId === undefined? 'global':'service'}/data-masking/restore`,
      {
        method: 'PATCH',
        eoParams: { 
          service:serviceId,
          team:teamId,
          strategy:entity.id},
      }
    ).then(response => {
      const { code, msg } = response
      if (code === STATUS_CODE.SUCCESS) {
        message.success(msg || $t(RESPONSE_TIPS.success))
        manualReloadTable()
      } else {
        message.error(msg || $t(RESPONSE_TIPS.error))
      }
    })
  }

  
  const onSubmit = () => {
        return drawerRef.current?.publish()?.then((res) => {
            manualReloadTable();
            return res;
        });
    }

  return (
    <>
      <PageList<DataMaskStrategyItem>
        id="data_masking_list"
        ref={pageListRef}
        columns={[...columns, ...operation]}
        request={async (params: DataMaskStrategyItem & {
          pageSize: number;
          current: number;
        },
        sort:Record<string, string>,
        filter:Record<string, string>) => getPolicyList(params,sort, filter)}
        addNewBtnTitle={$t("添加策略")}
        addNewBtnAccess="system.organization.member.edit"
        onAddNewBtnClick={() => { addPolicy() }}
        searchPlaceholder={$t("输入名称、筛选条件查找")}
        afterNewBtn={
          publishBtn && [<WithPermission key="removeFromDepPermission" access="system.organization.member.edit">
            <Button className="mr-btnbase" key="removeFromDep" onClick={() => publish()}>{$t('发布')}</Button>
            </WithPermission>]
        }
        onSearchWordChange={(e) => {
          setSearchWord(e.target.value)
        }}
        manualReloadTable={manualReloadTable}
      />
       <DrawerWithFooter 
              destroyOnClose={true} 
              title={$t('申请发布')}
              width={'60%'}
              onClose={()=>{setDrawerVisible(false)}}
              okBtnTitle={$t('发布')}
              open={drawerVisible}
              submitDisabled={!isOkToPublish}
              submitAccess={`team.service.release.add`}
              onSubmit={onSubmit}
              >
                <PolicyPublishModalContent 
                    ref={drawerRef}
                    data={drawerData! }
                     />
          </DrawerWithFooter>
    </>
  )
}

export default DataMasking;