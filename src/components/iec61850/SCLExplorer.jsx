import React, { useState } from 'react';
import { FolderOpen, Cpu, Layers, Disc, Circle, ChevronDown, ChevronRight, FileText } from 'lucide-react';

export default function SCLExplorer({ onSelectPath }) {
  const [treeData, setTreeData] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedPath, setSelectedPath] = useState(null);
  const [fileName, setFileName] = useState('');

  // Default fallback tree in case no SCL is uploaded
  const defaultTree = [
    {
      id: 'MYSCL',
      name: 'MYSCL (模拟变电站 IED)',
      type: 'ied',
      children: [
        {
          id: 'MYSCL/LLN0',
          name: 'LLN0 (逻辑节点 0 - 设备管理)',
          type: 'ln',
          children: [
            {
              id: 'MYSCL/LLN0$ST$Mod$stVal',
              name: 'Mod.stVal (运行模式状态 - ST)',
              type: 'da',
              path: 'MYSCL/LLN0$ST$Mod$stVal',
              bType: 'INT32'
            },
            {
              id: 'MYSCL/LLN0$ST$Beh$stVal',
              name: 'Beh.stVal (行为 - ST)',
              type: 'da',
              path: 'MYSCL/LLN0$ST$Beh$stVal',
              bType: 'INT32'
            }
          ]
        },
        {
          id: 'MYSCL/CSWI1',
          name: 'CSWI1 (开关逻辑控制)',
          type: 'ln',
          children: [
            {
              id: 'MYSCL/CSWI1$ST$Pos$stVal',
              name: 'Pos.stVal (位置状态 - ST)',
              type: 'da',
              path: 'MYSCL/CSWI1$ST$Pos$stVal',
              bType: 'INT32'
            },
            {
              id: 'MYSCL/CSWI1$CO$Pos$Oper$ctlVal',
              name: 'Pos.Oper.ctlVal (位置操作控制 - CO)',
              type: 'da',
              path: 'MYSCL/CSWI1$CO$Pos$Oper$ctlVal',
              bType: 'BOOLEAN'
            }
          ]
        },
        {
          id: 'MYSCL/MMXU1',
          name: 'MMXU1 (三相电量测量)',
          type: 'ln',
          children: [
            {
              id: 'MYSCL/MMXU1$MX$A$phsA$cVal$mag$f',
              name: 'A.phsA.cVal.mag.f (A相电流 - MX)',
              type: 'da',
              path: 'MYSCL/MMXU1$MX$A$phsA$cVal$mag$f',
              bType: 'FLOAT32'
            },
            {
              id: 'MYSCL/MMXU1$MX$A$phsB$cVal$mag$f',
              name: 'A.phsB.cVal.mag.f (B相电流 - MX)',
              type: 'da',
              path: 'MYSCL/MMXU1$MX$A$phsB$cVal$mag$f',
              bType: 'FLOAT32'
            },
            {
              id: 'MYSCL/MMXU1$MX$A$phsC$cVal$mag$f',
              name: 'A.phsC.cVal.mag.f (C相电流 - MX)',
              type: 'da',
              path: 'MYSCL/MMXU1$MX$A$phsC$cVal$mag$f',
              bType: 'FLOAT32'
            },
            {
              id: 'MYSCL/MMXU1$MX$PhV$phsA$cVal$mag$f',
              name: 'PhV.phsA.cVal.mag.f (A相电压 - MX)',
              type: 'da',
              path: 'MYSCL/MMXU1$MX$PhV$phsA$cVal$mag$f',
              bType: 'FLOAT32'
            }
          ]
        }
      ]
    }
  ];

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const handleNodeClick = (node) => {
    if (node.type === 'da') {
      setSelectedPath(node.path);
      if (onSelectPath) {
        onSelectPath(node.path, node.bType, node.itemDesc || '');
      }
    } else {
      toggleExpand(node.id);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(evt.target.result, 'text/xml');
        
        // Find DataTypeTemplates first to help resolve structures
        const lNodeTypes = {};
        const doTypes = {};
        const daTypes = {};
        
        const lnTypesEl = xmlDoc.getElementsByTagName('LNodeType');
        for (let i = 0; i < lnTypesEl.length; i++) {
          const el = lnTypesEl[i];
          const id = el.getAttribute('id');
          lNodeTypes[id] = Array.from(el.getElementsByTagName('DO')).map(d => ({
            name: d.getAttribute('name'),
            type: d.getAttribute('type'),
            desc: d.getAttribute('desc') || ''
          }));
        }

        const doTypesEl = xmlDoc.getElementsByTagName('DOType');
        for (let i = 0; i < doTypesEl.length; i++) {
          const el = doTypesEl[i];
          const id = el.getAttribute('id');
          doTypes[id] = Array.from(el.getElementsByTagName('DA')).map(d => ({
            name: d.getAttribute('name'),
            fc: d.getAttribute('fc'),
            bType: d.getAttribute('bType'),
            type: d.getAttribute('type'),
            desc: d.getAttribute('desc') || ''
          }));
        }

        const daTypesEl = xmlDoc.getElementsByTagName('DAType');
        for (let i = 0; i < daTypesEl.length; i++) {
          const el = daTypesEl[i];
          const id = el.getAttribute('id');
          daTypes[id] = Array.from(el.getElementsByTagName('BDA')).map(d => ({
            name: d.getAttribute('name'),
            bType: d.getAttribute('bType'),
            type: d.getAttribute('type'),
            desc: d.getAttribute('desc') || ''
          }));
        }

        // Parse IEDs
        const ieds = xmlDoc.getElementsByTagName('IED');
        const parsedTree = [];

        for (let i = 0; i < ieds.length; i++) {
          const ied = ieds[i];
          const iedName = ied.getAttribute('name');
          const iedDesc = ied.getAttribute('desc');
          
          const iedNode = {
            id: iedName,
            name: iedDesc ? `${iedName} (${iedDesc})` : `${iedName} (IED)`,
            type: 'ied',
            children: []
          };

          const lDevices = ied.getElementsByTagName('LDevice');
          for (let j = 0; j < lDevices.length; j++) {
            const ld = lDevices[j];
            const ldInst = ld.getAttribute('inst');
            const ldDesc = ld.getAttribute('desc');
            const ldPath = `${iedName}${ldInst}`; // Domain name, e.g. TEMPLATE_LD0
            
            const ldNode = {
              id: ldPath,
              name: ldDesc ? `${ldInst} (${ldDesc})` : `${ldInst} (Logical Device)`,
              type: 'ld',
              children: []
            };

            // Parse LNs
            const ln0s = ld.getElementsByTagName('LN0');
            const lns = ld.getElementsByTagName('LN');
            const allLns = [...Array.from(ln0s), ...Array.from(lns)];

            allLns.forEach(ln => {
              const prefix = ln.getAttribute('prefix') || '';
              const lnClass = ln.getAttribute('lnClass');
              const inst = ln.getAttribute('inst') || '';
              const lnType = ln.getAttribute('lnType');
              const lnDesc = ln.getAttribute('desc');
              const lnName = `${prefix}${lnClass}${inst}`;
              const lnPath = `${ldPath}/${lnName}`;

              const lnNode = {
                id: lnPath,
                name: lnDesc ? `${lnName} (${lnClass} - ${lnDesc})` : `${lnName} (${lnClass})`,
                type: 'ln',
                children: []
              };

              // Resolve LNodeType attributes
              const doList = lNodeTypes[lnType] || [];
              doList.forEach(doItem => {
                const doName = doItem.name;
                const doTypeId = doItem.type;
                const daList = doTypes[doTypeId] || [];

                daList.forEach(daItem => {
                  const daName = daItem.name;
                  const fc = daItem.fc || 'ST';
                  const bType = daItem.bType;
                  
                  if (daItem.type) {
                    // Structure DA (like cVal) -> look up DAType
                    const bdas = daTypes[daItem.type] || [];
                    bdas.forEach(bda => {
                      const doDesc = doItem.desc || '';
                      const daDesc = daItem.desc || '';
                      const bdaDesc = bda.desc || '';
                      const itemDesc = (doDesc || daDesc || bdaDesc) ? 
                        `[${doDesc}${doDesc && (daDesc || bdaDesc) ? ' / ' : ''}${daDesc}${daDesc && bdaDesc ? ' / ' : ''}${bdaDesc}]` : '';
                      const bdaPath = `${lnPath}$${fc}$${doName}$${daName}$${bda.name}`;
                      lnNode.children.push({
                        id: bdaPath,
                        name: itemDesc ? `${doName}.${daName}.${bda.name} (${fc}) - ${itemDesc}` : `${doName}.${daName}.${bda.name} (${fc})`,
                        type: 'da',
                        path: `${ldPath}/${bdaPath}`,
                        bType: bda.bType,
                        itemDesc: itemDesc
                      });
                    });
                  } else {
                    // Simple DA (like stVal)
                    const doDesc = doItem.desc || '';
                    const daDesc = daItem.desc || '';
                    const itemDesc = (doDesc || daDesc) ? `[${doDesc}${doDesc && daDesc ? ' / ' : ''}${daDesc}]` : '';
                    const daPath = `${lnPath}$${fc}$${doName}$${daName}`;
                    lnNode.children.push({
                      id: daPath,
                      name: itemDesc ? `${doName}.${daName} (${fc}) - ${itemDesc}` : `${doName}.${daName} (${fc})`,
                      type: 'da',
                      path: `${ldPath}/${daPath}`,
                      bType: bType,
                      itemDesc: itemDesc
                    });
                  }
                });
              });

              if (lnNode.children.length > 0) {
                ldNode.children.push(lnNode);
              }
            });

            if (ldNode.children.length > 0) {
              iedNode.children.push(ldNode);
            }
          }

          if (iedNode.children.length > 0) {
            parsedTree.push(iedNode);
          } else {
            // Fallback for simple flat LN listings
            const flatLns = ied.getElementsByTagName('LN');
            if (flatLns.length > 0) {
              const fallbackLd = { id: `${iedName}LD0`, name: 'LD0 (Flat LDevice)', type: 'ld', children: [] };
              Array.from(flatLns).forEach(ln => {
                fallbackLd.children.push({
                  id: `${iedName}LD0/${ln.getAttribute('lnClass')}`,
                  name: `${ln.getAttribute('lnClass')} (LN)`,
                  type: 'ln',
                  children: []
                });
              });
              iedNode.children.push(fallbackLd);
              parsedTree.push(iedNode);
            }
          }
        }

        if (parsedTree.length > 0) {
          setTreeData(parsedTree);
          // Auto-expand top node
          setExpandedNodes(new Set([parsedTree[0].id]));
        } else {
          alert('解析 SCL 文件失败，未找到有效的 IED 模型数据，已加载默认模型');
          setTreeData(defaultTree);
        }
      } catch (e) {
        alert(`解析 XML 错误: ${e.message}。将使用默认模型`);
        setTreeData(defaultTree);
      }
    };
    reader.readAsText(file);
  };

  const currentTree = treeData || defaultTree;

  const renderNode = (node) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedPath === node.path;

    return (
      <div key={node.id} className="tree-node">
        <div
          className={`tree-label ${isSelected ? 'selected' : ''}`}
          onClick={() => handleNodeClick(node)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: '3px 0' }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={14} color="var(--text-secondary)" /> : <ChevronRight size={14} color="var(--text-secondary)" />
          ) : (
            <span style={{ width: '14px' }} />
          )}

          {node.type === 'ied' && <Cpu size={14} color="var(--color-accent)" />}
          {node.type === 'ld' && <Layers size={14} color="var(--color-info)" />}
          {node.type === 'ln' && <Disc size={14} color="var(--color-warning)" />}
          {node.type === 'da' && <Circle size={8} color={isSelected ? 'var(--color-accent)' : 'var(--text-muted)'} style={{ margin: '0 3px' }} />}

          <span style={{ fontSize: '13px', color: node.type === 'da' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isSelected ? '600' : '400' }}>
            {node.name}
          </span>
        </div>

        {hasChildren && isExpanded && (
          <div style={{ paddingLeft: '8px', borderLeft: '1px dashed rgba(255, 255, 255, 0.05)' }}>
            {node.children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="pane" style={{ height: '100%' }}>
      <div className="pane-header">
        <h3>
          <FolderOpen size={16} color="var(--color-accent)" />
          SCL 模型资源管理器 (ICD/CID)
        </h3>
      </div>
      <div className="pane-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
            <FileText size={14} color="var(--color-accent)" />
            导入 SCL/CID 配置文件
            <input type="file" accept=".xml,.icd,.cid,.scd" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          {fileName && (
            <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              已载入: {fileName}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0, 0, 0, 0.1)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
          {currentTree.map(node => renderNode(node))}
        </div>
      </div>
    </div>
  );
}
