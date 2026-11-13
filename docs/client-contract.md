# 小程序界面与数据服务约定

本阶段交付微信原生小程序本地开发骨架；不交付 H5。页面只通过 `miniprogram/services/repository.js` 操作数据。默认 `demo` 模式，始终显示演示标识；云端未接入时必须明确报错，不能自动回退伪装成功。

## 页面与公共样式

四个 tab：`pages/home/index`、`pages/archive/index`、`pages/upload/index`、`pages/profile/index`。
详情页：`pages/visit/index?id=...`、`pages/document/index?id=...`、`pages/medication/index?id=...`、`pages/person/index?id=...`（新建不传 id）。

页面均 CommonJS JavaScript + WXML + WXSS + JSON，无 npm UI 依赖。全局样式由根代理提供：`.page`, `.card`, `.title`, `.subtitle`, `.row`, `.muted`, `.badge`, `.primary`, `.secondary`, `.field`, `.input`, `.section-title`, `.empty`, `.notice`, `.demo-banner`, `.person-chip`, `.person-chip.active`。字体和间距使用 rpx，底色 #F7F8F4，主色 #35664E。

所有服务方法返回 Promise；捕获错误并通过 wx.showToast 或页面错误文案展示。所有 id 为字符串。

## 实体

- Person `{id,name,birthDate,avatarPath,version}`；名称用于展示，生日可为空。
- Visit `{id,personId,date,hospital,doctor,chiefComplaint,examination,diagnosis,symptoms:[],episodeId,version,documentCount}`。
- Document `{id,personId,kind,visitIds:[],files:[{id,path,name,type}],status,extracted,version,createdBy,updatedAt}`。kind 为 `medical` / `lab` / `prescription`；status 为 `uploaded` / `review` / `confirmed`。同一原件允许多个 visitIds。
- Extracted `{patientName,age,date,hospital,department,doctor,chiefComplaint,examination,diagnosis,symptoms:[],items:[{name,value,unit,referenceRange,flag}],findings,conclusion,collectionDate,reportDate,prescriptionDate,medications:[{name,specification,dose,frequency,duration}],needsReview:[]}`。所有识别项可为空，不能自动猜日期/剂量。保留单据年龄、科室、采样／报告／开方日期；`date` 为该资料归档检索的医疗事件日期，不是上传日期。
- Medication `{id,personId,documentId,visitId,name,specification,dose,frequency,duration,startDate,stopDate,note,version}`。startDate/stopDate 是实际服药日期，默认空，与处方日期分开。

## 服务

- `boot()` → `{persons,activePersonId,family,mode}`；family `{name,role,members:[{name,role}]}`。
- `getActivePerson()` → Person/null；`setActivePerson(id)` → Person；`listPersons()` → Person[]。
- `savePerson({id?,name,birthDate,avatarPath,version?})` → Person。
- `getOverview(personId, period)` → `{visitCount,documentCount,prescriptionCount,episodeCount,recentVisits,rangeLabel}`；period `recent` / `quarter` / `year`。
- `listVisits({personId,query,category,start,end})` → Visit[]；category `all` / `symptom` / `diagnosis` / `lab` / `medication`，start/end YYYY-MM-DD 可空。结果含 `matchText`。
- `getVisit(id)` → `{visit,documents,medications}`，须匹配当前所属人。
- `listDocuments(personId,{unlinked:false}={})` → Document[]。
- `getDocument(id)` → Document，须匹配当前所属人。
- `uploadDocument({personId,kind,files,visitId?})` → Document。多张同类单据作为一份多页资料；页面负责选择图片或 PDF。
- `recognizeDocument(id)` → Document（demo 为明确标注的模拟识别，cloud 未接入报错）。
- `confirmDocument({id,version,extracted,visitId?,createVisit:false})` → `{document,visitId}`；既有就诊、创建新就诊、只保存资料三种路径。最终选择覆盖上传时推荐的关联位置；确认后需要引用到更多就诊时调用 `linkDocument`。
- `linkDocument({documentId,visitId,version})` → Document；同人校验，不复制原件。
- `getMedication(id)` → Medication；`updateMedication({id,version,startDate,stopDate,note})` → Medication。
- `getFileUrl(file)` → 本地 path 或云端授权后的 URL。demo 无原图的种子资料返回空字符串，界面显示“示例资料无原件，请自行添加演示照片”，不能伪装真实原件。
- `getFamily()` → family；真实邀请入口本阶段提示需要接入微信云服务，不生成假邀请码。
- `resetDemo()` → 清空当前演示并重新初始化，尝试回收本程序保存的原件和头像副本（调用前页面确认）；不删除用户相册原图或其他程序文件。

## 本阶段约束

页面切换孩子后清空上一人的局部选择；详情和修改服务都验证所属人。手动改识别内容不覆盖原件。空日期、阴性/否定、疑似等原文保留；症状标签由人确认。季度和季节不同，冬季 12 月至次年 2 月，时间筛选显示实际日期。只按已确认病程统计，报告引用不重复计数。资料仅家庭内可见的服务端校验列入下一阶段验收，不声称本机演示已实现多人同步。
