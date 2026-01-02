export interface NodeData {
    id: string;
    coordinates: [number, number];
    type: 'intersection' | 'entrance' | 'amenity';
    building?: string;
    amentityType: 'bathroom' | 'printer' | 'water';
    accessible: boolean;
}

export interface EdgeData {
    id: string;
    from: string;
    to: string;
    distance: number;
    accessible: boolean;
    isShortcut: boolean;
  }
  
  export interface Route {
    nodes: NodeData[];
    totalDistance: number;
    coordinates: [number, number][];
  }