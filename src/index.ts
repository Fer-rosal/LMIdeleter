import fs from 'fs';
import csvParser from 'csv-parser';
import axios from 'axios';

import dotenv from 'dotenv';
import { TupleType } from 'typescript';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

// Ruta al archivo CSV
const csvFilePath: string = process.env.PATH_TO_CSV || './hosts.csv';

// Token de autenticación desde el .env
const username: string | undefined = process.env.USERNAME;
const password: string | undefined = process.env.PASSWORD;

// Codificar las credenciales en base64
const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

// Función para leer el CSV, que solo lleva una serie de nombres separados por comas, y extraer cada nombre a un array
function readFileAndParseToArray(filePath: string): string[] {
    try {
      // Leer el contenido del fichero
      const data = fs.readFileSync(filePath, 'utf8');
      
      // Dividir el contenido por comas y eliminar espacios en blanco
      const array = data.split('\n').map(item => item.trim());
      
      return array;
    } catch (error) {
      console.error('Error al leer el fichero:', error);
      return [];
    }
  }

// La respuesta de la API de LogmeIn al bajarse la lista de hosts tiene el siguiente tipo:
type ApiResponse = [{ description: string; id: number }];


//Función para bajarse los hosts de la API de LogMein. Nos devuelve un array con los hosts y los guardamos como tuplas un Set
async function getHosts(): Promise<Map<string, number>> {
    const hostMap = new Map<string, number>();
    try {
        const response = await axios.get('https://secure.logmein.com/public-api/v1/hosts', {
            headers: {
                'Authorization': `Basic ${basicAuth}`
            }
        });
        let data:ApiResponse = response.data.hosts;
        for (let i = 0; i < data.length; i++) {
            hostMap.set(data[i].description, data[i].id);
        }
        console.log('Size es '+hostMap.size);
        //grabamos la lista de hosts descargados en un csv
        const ws = fs.createWriteStream('LMIhosts.csv');
        ws.write('description,id\n');
        for (const [key, value] of hostMap) {
            ws.write(`${key},${value}\n`);
        }
        ws.end();
        
        
        
       
       
    } catch (error: any) {
    
        console.error(`Error al obtener los hosts: ${error.status} `, error.response ? error.response.data : error.message);
    }
    return hostMap;
}

// Función para realizar la solicitud DELETE para un array de IDs
async function deleteHost(id:number[]): Promise<void> {
    try {
        const response = await axios.delete('https://secure.logmein.com/public-api/v1/hosts', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${basicAuth}`
            },
            data: {
                hostIds: id
            }
        });
        console.log(`Response for ID ${id}:`, response.status);
    } catch (error: any) {
        console.error(`Error for ID ${id}: ${error.status}`, error.response ? error.response.data : error.message);
    }
}

// Función principal para ejecutar el programa
(async function main() {
    try {
        const hostnames: string[] = await readFileAndParseToArray(csvFilePath);
        console.log('IDs leídos del CSV:', hostnames);
        //bajar los hosts de la PI de LogMein
        const hostMap = await getHosts();
        //para cada hostname, buscamos si existe ese elemento en el Map y añadimos al array de hostsToDelete la id de ese elemento
        const hostsToDelete: number[] = [];
        for (const hostname of hostnames) {
            const id = hostMap.get(hostname);
            if (id) {
                hostsToDelete.push(id);
            } else {
                console.error(`No se encontró el host con el nombre ${hostname}`);
            }
        }
        //ahora eliminamos los hosts
         hostsToDelete.length>0? await deleteHost(hostsToDelete): console.log('No hay hosts para eliminar'); 
    } catch (error) {
        console.error('Error en el procesamiento:', error);
    }
})();
