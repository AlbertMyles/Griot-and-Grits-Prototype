import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData } from '../types';
import { Info, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function ConceptMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const mediaSnap = await getDocs(collection(db, 'media'));
      const entitiesSnap = await getDocs(collection(db, 'entities'));

      const nodes = mediaSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().title,
        type: 'media'
      }));

      const entityNodesMap = new Map();
      entitiesSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!entityNodesMap.has(data.name)) {
          entityNodesMap.set(data.name, {
            id: `entity-${data.name}`,
            name: data.name,
            type: data.type
          });
        }
      });

      const links = entitiesSnap.docs.map(doc => ({
        source: doc.data().media_id,
        target: `entity-${doc.data().name}`
      }));

      setData({
        nodes: [...nodes, ...Array.from(entityNodesMap.values())],
        links
      });
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const container = svgRef.current.parentElement;
    if (!container) return;

    const updateSize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const g = svg.append("g");

      const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        });

      svg.call(zoom as any);

      const simulation = d3.forceSimulation(data.nodes as any)
        .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

      const link = g.append("g")
        .attr("stroke", "#000")
        .attr("stroke-opacity", 0.1)
        .selectAll("line")
        .data(data.links)
        .join("line")
        .attr("stroke-width", 1);

      const node = g.append("g")
        .selectAll("g")
        .data(data.nodes)
        .join("g")
        .call(d3.drag<any, any>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended) as any)
        .on("click", (event, d) => setSelectedNode(d));

      node.append("circle")
        .attr("r", (d: any) => d.type === 'media' ? 12 : 8)
        .attr("fill", (d: any) => {
          switch(d.type) {
            case 'media': return '#F27D26';
            case 'People': return '#10b981';
            case 'Places': return '#f59e0b';
            case 'Events': return '#ef4444';
            case 'Movements': return '#8b5cf6';
            default: return '#9ca3af';
          }
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

      node.append("text")
        .attr("dx", 15)
        .attr("dy", 4)
        .text((d: any) => d.name)
        .attr("font-size", "10px")
        .attr("font-weight", "600")
        .attr("fill", "#1A1A1A")
        .style("pointer-events", "none");

      simulation.on("tick", () => {
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);

        node
          .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      });

      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    updateSize();

    return () => observer.disconnect();
  }, [data]);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden relative">
      <header className="p-6 border-b border-black/5 flex items-center justify-between bg-white z-10">
        <div>
          <h3 className="text-xl font-serif italic font-bold">Relational Concept Map</h3>
          <p className="text-xs text-black/40 uppercase tracking-widest font-mono">Visualizing Cultural Intersections</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-4 px-4 py-2 bg-[#F5F2ED] rounded-xl text-[10px] font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#F27D26]" /> Media</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#10b981]" /> People</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Places</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#ef4444]" /> Events</div>
          </div>
        </div>
      </header>

      <div className="flex-1 bg-[#F5F2ED]/20 relative">
        <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        
        {selectedNode && (
          <div className="absolute top-6 right-6 w-64 bg-white p-6 rounded-2xl shadow-xl border border-black/5 animate-in fade-in slide-in-from-right-4">
            <button 
              onClick={() => setSelectedNode(null)}
              className="absolute top-4 right-4 text-black/20 hover:text-black"
            >
              <RefreshCw size={14} />
            </button>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded mb-2 inline-block ${
              selectedNode.type === 'media' ? 'bg-[#F27D26]/10 text-[#F27D26]' : 'bg-black/5 text-black/60'
            }`}>
              {selectedNode.type}
            </span>
            <h4 className="font-bold text-lg mb-2">{selectedNode.name}</h4>
            <p className="text-sm text-black/60 leading-relaxed">
              {selectedNode.type === 'media' 
                ? "Click to view full oral history details in the collection."
                : "This entity is mentioned across multiple oral histories in the archive."}
            </p>
          </div>
        )}

        <div className="absolute bottom-6 left-6 flex flex-col gap-2">
          <button className="p-3 bg-white shadow-lg rounded-xl hover:bg-[#F5F2ED] transition-colors"><ZoomIn size={20} /></button>
          <button className="p-3 bg-white shadow-lg rounded-xl hover:bg-[#F5F2ED] transition-colors"><ZoomOut size={20} /></button>
        </div>
      </div>
    </div>
  );
}
