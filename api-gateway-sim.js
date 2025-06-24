const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
const lambda = require('./lambda/index');

// Use a single process for API Gateway simulation to avoid port binding conflicts
const app = express();
  
  // Increase maximum payload size
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

  // Error handling middleware
  const errorHandler = (err, req, res, _next) => {
    console.error('API Error:', err);
    res.status(500).json({ 
      error: err.message || 'Internal server error',
      code: err.name 
    });
  };

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'api-gateway-simulation'
    });
  });

  // Add performance monitoring middleware
  app.use((req, res, next) => {
    const start = process.hrtime();
    
    // Add response hook to measure duration
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = seconds * 1000 + nanoseconds / 1e6; // Convert to milliseconds
    
      console.log({
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration.toFixed(2)}ms`
      });
    });
    
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      worker: process.pid
    });
  });

  // POST /upload
  app.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log(`Processing upload for ${file.originalname}`);
      
      // Ensure the file has a buffer
      if (!file.buffer) {
        return res.status(400).json({ error: 'Invalid file format or empty file' });
      }
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: file.originalname,
          content: file.buffer.toString('base64')
        })
      };

      try {
        const result = await lambda.handler(event);
        
        // Check if result has proper structure
        if (!result || !result.body) {
          console.error('Invalid Lambda response structure:', result);
          return res.status(500).json({ error: 'Invalid Lambda response' });
        }
        
        let body;
        try {
          body = JSON.parse(result.body);
        } catch (parseError) {
          console.error(`Error parsing Lambda response: ${parseError.message}`, result.body);
          return res.status(500).json({ error: 'Invalid JSON response from Lambda' });
        }
        
        res.status(result.statusCode).json(body);
      } catch (lambdaError) {
        console.error('Error invoking Lambda:', lambdaError);
        res.status(500).json({ 
          error: 'Error invoking Lambda function', 
          details: lambdaError.message 
        });
      }
    } catch (err) {
      console.error('Error in upload handler:', err);
      next(err);
    }
  });

  // GET /download?filename=...
  app.get('/download', async (req, res, next) => {
    try {
      const filename = req.query.filename;
      if (!filename) {
        return res.status(400).json({ error: 'Missing filename parameter' });
      }

      console.log(`Processing download for ${filename}`);
      
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { filename }
      };

      const result = await lambda.handler(event);
      
      // Handle potential errors in result parsing
      let body;
      try {
        body = JSON.parse(result.body);
      } catch (parseError) {
        console.error(`Error parsing Lambda response: ${parseError.message}`, result.body);
        return res.status(500).json({ error: 'Invalid response from Lambda' });
      }

      if (result.statusCode === 200) {
        // Validate that content exists before attempting to use it
        if (!body.content) {
          console.error('Missing content in successful response:', body);
          return res.status(500).json({ error: 'Missing content in response' });
        }
        
        try {
          const buffer = Buffer.from(body.content, 'base64');
          res.set('Content-Disposition', `attachment; filename="${filename}"`);
          res.set('Content-Type', 'application/octet-stream');
          res.send(buffer);
        } catch (bufferError) {
          console.error(`Error creating buffer from content: ${bufferError.message}`);
          return res.status(500).json({ error: 'Invalid content format' });
        }
      } else {
        res.status(result.statusCode).json(body);
      }
    } catch (err) {
      console.error('Error in download handler:', err);
      next(err);
    }
  });

  // Add error handling middleware
  app.use(errorHandler);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 API Gateway simulation running on port ${PORT}`);
    console.log(`POST /upload   - Upload files`);
    console.log(`GET /download  - Download files`);
  });
