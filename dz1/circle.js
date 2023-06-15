"use strict"

// Vertex shader program
const VSHADER_SOURCE =
    "attribute vec4 a_Position;\n" +
    "attribute float a_select;\n" +
    "uniform mat4 u_projMatrix;\n" +
    "uniform float u_pointSize;\n" +
    "uniform vec4 u_color;\n" +
    "uniform vec4 u_colorSelect;\n" +
    "varying vec4 v_color;\n" +
    "void main() {\n" +
    "  gl_Position = u_projMatrix * a_Position;\n" +
    "  gl_PointSize = u_pointSize;\n" +
    "  if (a_select != 0.0)\n" +
    "    v_color = u_colorSelect;\n" +
    "  else\n" +
    "    v_color = u_color;\n" +
    "}\n"

// Fragment shader program
const FSHADER_SOURCE =
    "precision mediump float;\n" +
    "varying vec4 v_color;\n" +
    "void main() {\n" +
    "  gl_FragColor = v_color;\n" +
    "}\n"

function main() {
    // Retrieve <canvas> element
    const canvas = document.getElementById("webgl")

    // Get the rendering context for WebGL
    const gl = getWebGLContext(canvas)
    if (!gl) {
        console.log("Failed to get the rendering context for WebGL")
        return
    }

    // Initialize shaders
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log("Failed to intialize shaders.")
        return
    }

    gl.viewport(0, 0, canvas.width, canvas.height)

    const projMatrix = mat4.ortho(
        mat4.create(),
        0,
        gl.drawingBufferWidth,
        0,
        gl.drawingBufferHeight,
        0,
        1
    )

    // Pass the projection matrix to the vertex shader
    const u_projMatrix = gl.getUniformLocation(gl.program, "u_projMatrix")
    if (!u_projMatrix) {
        console.log("Failed to get the storage location of u_projMatrix")
        return
    }
    gl.uniformMatrix4fv(u_projMatrix, false, projMatrix)

    const countCirclePoints = document.getElementById("countCirclePoints")
    const countSplinePoints = document.getElementById("countSplinePoints")
    const x0 = document.getElementById("x0")
    const y0 = document.getElementById("y0")
    const radius = document.getElementById("radius")

    // Register function (event handler) to be called on a mouse press
    canvas.onmousemove = function (ev) {
        mousemove(ev, canvas)
    }

    canvas.onmousedown = function (ev) {
        mousedown(ev, canvas)
    }

    canvas.onmouseup = function (ev) {
        mouseup(ev, canvas)
    }

    const spline = document.getElementById("chkSpline")
    const controlPolygon = document.getElementById("chkControlPolygon")
    const visualizeSplineWithPoints = document.getElementById(
        "chkVisualizeWithPoints"
    )
    const visualizeSplineWithLines = document.getElementById(
        "chkVisualizeWithLine"
    )

    const showCircle = document.getElementById("chkCircle")

    spline.onclick = function () {
        Data.plotMode(1)
    }
    countSplinePoints.onchange = function () {
        Data.plotMode(2)
    }
    controlPolygon.onclick = function () {
        Data.plotMode(3)
    }
    visualizeSplineWithPoints.onclick = function () {
        Data.plotMode(4)
    }
    visualizeSplineWithLines.onclick = function () {
        Data.plotMode(5)
    }
    x0.onchange = function () {
        Data.plotMode(6)
    }
    y0.onchange = function () {
        Data.plotMode(6)
    }
    radius.onchange = function () {
        Data.plotMode(6)
    }
    countCirclePoints.onchange = function () {
        Data.plotMode(8)
    }
    showCircle.onclick = function () {
        Data.plotMode(7)
    }

    // Specify the color for clearing <canvas>
    gl.clearColor(0.8, 0.8, 0.8, 1.0)

    // Clear <canvas>
    gl.clear(gl.COLOR_BUFFER_BIT)

    Data.init(gl, x0, y0, radius, countCirclePoints, countSplinePoints)
}

class Point {
    constructor(x, y) {
        this.select = false
        this.h = 1
        this.x = x
        this.y = y
        this.setRect()
    }
    setPoint(x, y, h) {
        this.x = x
        this.y = y
        if (h != undefined) this.h = h
        this.setRect()
    }
    setRect() {
        this.left = this.x - 5
        this.right = this.x + 5
        this.bottom = this.y - 5
        this.up = this.y + 5
    }
    ptInRect(x, y) {
        const inX = this.left <= x && x <= this.right
        const inY = this.bottom <= y && y <= this.up
        return inX && inY
    }
}

const Data = {
    pointsCtr: [],
    pointsSpline: [],
    pointsCircle: [],
    countAttribData: 3, //x,y,sel
    verticesCtr: {},
    verticesSpline: {},
    verticesCircle: {},
    FSIZE: 0,
    gl: null,
    vertexBufferCtr: null,
    vertexBufferSpline: null,
    vertexBufferCircle: null,
    a_Position: -1,
    a_select: -1,
    u_color: null,
    u_colorSelect: null,
    u_pointSize: null,
    movePoint: false,
    iMove: -1,
    leftButtonDown: false,
    drawControlPolygon: false,
    drawSpline: false,
    drawCirclePoints: true,
    visualizeSplineWithPoints: true,
    visualizeSplineWithLine: false,
    countCtrPoints: 0,
    countSplinePoints: null,
    countCirclePoints: null,
    radius: null,
    x0: null,
    y0: null,
    init: function (gl, x0, y0, radius, countCirclePoints, countSplinePoints) {
        this.gl = gl
        // Create a buffer object
        this.vertexBufferCtr = this.gl.createBuffer()
        if (!this.vertexBufferCtr) {
            console.log("Failed to create the buffer object for control points")
            return -1
        }
        this.vertexBufferSpline = this.gl.createBuffer()
        if (!this.vertexBufferSpline) {
            console.log("Failed to create the buffer object for spline points")
            return -1
        }
        this.vertexBufferCircle = this.gl.createBuffer()
        if (!this.vertexBufferCircle) {
            console.log("Failed to create the buffer object for circle points")
            return -1
        }

        this.a_Position = this.gl.getAttribLocation(
            this.gl.program,
            "a_Position"
        )
        if (this.a_Position < 0) {
            console.log("Failed to get the storage location of a_Position")
            return -1
        }

        this.a_select = this.gl.getAttribLocation(this.gl.program, "a_select")
        if (this.a_select < 0) {
            console.log("Failed to get the storage location of a_select")
            return -1
        }

        // Get the storage location of u_color
        this.u_color = this.gl.getUniformLocation(this.gl.program, "u_color")
        if (!this.u_color) {
            console.log("Failed to get u_color variable")
            return
        }

        // Get the storage location of u_colorSelect
        this.u_colorSelect = gl.getUniformLocation(
            this.gl.program,
            "u_colorSelect"
        )
        if (!this.u_colorSelect) {
            console.log("Failed to get u_colorSelect variable")
            return
        }

        // Get the storage location of u_pointSize
        this.u_pointSize = gl.getUniformLocation(this.gl.program, "u_pointSize")
        if (!this.u_pointSize) {
            console.log("Failed to get u_pointSize variable")
            return
        }

        // ЗАДАТЬ КОЛИЧЕСТВО КОНТРОЛЬНЫХ ТОЧЕК
        this.countCtrPoints = 7

        this.countCirclePoints = countCirclePoints
        this.countSplinePoints = countSplinePoints
        this.x0 = x0
        this.y0 = y0
        this.radius = radius

        this.setCountCtrPoints()
    },
    setLeftButtonDown: function (value) {
        this.leftButtonDown = value
    },
    setCountCtrPoints: function () {
        this.pointsCtr = new Array(this.countCtrPoints)
        for (let i = 0; i < this.countCtrPoints; i++)
            this.pointsCtr[i] = new Point(0, 0)

        this.setCtrPoints()
    },
    mousemoveHandler: function (x, y) {
        if (this.leftButtonDown) {
            if (this.movePoint) {
                this.pointsCtr[this.iMove].setPoint(x, y)

                this.verticesCtr[this.iMove * this.countAttribData] =
                    this.pointsCtr[this.iMove].x
                this.verticesCtr[this.iMove * this.countAttribData + 1] =
                    this.pointsCtr[this.iMove].y

                this.setVertexBuffersAndDraw()

                if (this.drawSpline) this.calculateSpline()
            }
        } else
            for (let i = 0; i < this.pointsCtr.length; i++) {
                this.pointsCtr[i].select = false

                if (this.pointsCtr[i].ptInRect(x, y))
                    this.pointsCtr[i].select = true

                this.verticesCtr[i * this.countAttribData + 2] =
                    this.pointsCtr[i].select

                this.setVertexBuffersAndDraw()
            }
    },
    mousedownHandler: function (button, x, y) {
        if (button == 0) {
            //left button
            this.movePoint = false

            for (let i = 0; i < this.pointsCtr.length; i++) {
                if (this.pointsCtr[i].select == true) {
                    this.movePoint = true
                    this.iMove = i
                }
            }

            this.setLeftButtonDown(true)
        }
    },
    mouseupHandler: function (button, x, y) {
        if (button == 0)
            //left button
            this.setLeftButtonDown(false)
    },
    setVertices: function () {
        this.verticesCtr = new Float32Array(
            this.pointsCtr.length * this.countAttribData
        )
        for (let i = 0; i < this.pointsCtr.length; i++) {
            this.verticesCtr[i * this.countAttribData] = this.pointsCtr[i].x
            this.verticesCtr[i * this.countAttribData + 1] = this.pointsCtr[i].y
            this.verticesCtr[i * this.countAttribData + 2] =
                this.pointsCtr[i].select
        }
        this.FSIZE = this.verticesCtr.BYTES_PER_ELEMENT
    },
    setVertexBuffersAndDraw: function () {
        // Clear <canvas>
        this.gl.clear(this.gl.COLOR_BUFFER_BIT)

        if (this.drawCirclePoints) {
            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferCircle)
            // Write date into the buffer object
            this.gl.bufferData(
                this.gl.ARRAY_BUFFER,
                this.verticesCircle,
                this.gl.DYNAMIC_DRAW
            )
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(
                this.a_Position,
                2,
                this.gl.FLOAT,
                false,
                0,
                0
            )
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position)
            // Disable the assignment to a_select variable
            this.gl.disableVertexAttribArray(this.a_select)

            this.gl.uniform4f(this.u_color, 0.0, 0.0, 1.0, 1.0)
            this.gl.uniform1f(this.u_pointSize, 10.0)

            this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.pointsCircle.length)
        }

        if (this.pointsCtr.length == 0) return

        // Bind the buffer object to target
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferCtr)
        // Write date into the buffer object
        this.gl.bufferData(
            this.gl.ARRAY_BUFFER,
            this.verticesCtr,
            this.gl.DYNAMIC_DRAW
        )
        // Assign the buffer object to a_Position variable
        this.gl.vertexAttribPointer(
            this.a_Position,
            2,
            this.gl.FLOAT,
            false,
            this.FSIZE * 3,
            0
        )
        // Enable the assignment to a_Position variable
        this.gl.enableVertexAttribArray(this.a_Position)
        // Assign the buffer object to a_select variable
        this.gl.vertexAttribPointer(
            this.a_select,
            1,
            this.gl.FLOAT,
            false,
            this.FSIZE * 3,
            this.FSIZE * 2
        )
        // Enable the assignment to a_select variable
        this.gl.enableVertexAttribArray(this.a_select)

        this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0)
        this.gl.uniform4f(this.u_colorSelect, 0.5, 0.5, 0.0, 1.0)
        this.gl.uniform1f(this.u_pointSize, 10.0)
        // Draw
        this.gl.drawArrays(this.gl.POINTS, 0, this.pointsCtr.length)
        if (this.drawControlPolygon) {
            this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0)
            this.gl.uniform4f(this.u_colorSelect, 0.0, 0.0, 0.0, 1.0)

            this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.pointsCtr.length)
        }
        if (this.drawSpline) {
            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferSpline)
            // Write date into the buffer object
            this.gl.bufferData(
                this.gl.ARRAY_BUFFER,
                this.verticesSpline,
                this.gl.DYNAMIC_DRAW
            )
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(
                this.a_Position,
                2,
                this.gl.FLOAT,
                false,
                0,
                0
            )
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position)
            // Disable the assignment to a_select variable
            this.gl.disableVertexAttribArray(this.a_select)

            this.gl.uniform4f(this.u_color, 1.0, 0.0, 0.0, 1.0)
            this.gl.uniform1f(this.u_pointSize, 7.0)

            if (this.visualizeSplineWithPoints)
                this.gl.drawArrays(this.gl.POINTS, 0, this.pointsSpline.length)

            if (this.visualizeSplineWithLine)
                this.gl.drawArrays(
                    this.gl.LINE_STRIP,
                    0,
                    this.pointsSpline.length
                )
        }
    },
    plotMode: function (selOption) {
        switch (selOption) {
            case 1:
                this.drawSpline = !this.drawSpline
                if (this.drawSpline) this.calculateSpline()
                break
            case 2:
                if (this.drawSpline) this.calculateSpline()
                break
            case 3:
                this.drawControlPolygon = !this.drawControlPolygon
                break
            case 4:
                this.visualizeSplineWithPoints = !this.visualizeSplineWithPoints
                break
            case 5:
                this.visualizeSplineWithLine = !this.visualizeSplineWithLine
                break
            case 6:
                this.setCtrPoints()
                if (this.drawSpline) this.calculateSpline()
                break
            case 7:
                this.drawCirclePoints = !this.drawCirclePoints
                if (this.drawCirclePoints) this.calculateCirclePoints()
                break
            case 8:
                if (this.drawCirclePoints) this.calculateCirclePoints()
                break
        }
        this.setVertexBuffersAndDraw()
    },
    setCtrPoints: function () {
        const x0 = parseInt(this.x0.value)
        const y0 = parseInt(this.y0.value)
        const r = parseInt(this.radius.value)

        // ЗАДАТЬ КООРДИНАТЫ КОНТРОЛЬНЫХ ТОЧЕК
        //weight hi=1 i even; hi = 0.5 i odd
        this.pointsCtr[0].setPoint(x0 + (r * Math.sqrt(3)) / 2, y0 + r / 2, 1) //p0
        this.pointsCtr[1].setPoint(x0, y0 + 2 * r, 0.5) //p1
        this.pointsCtr[2].setPoint(x0 - (r * Math.sqrt(3)) / 2, y0 + r / 2, 1) //p2
        this.pointsCtr[3].setPoint(x0 - r * Math.sqrt(3), y0 - r, 0.5) //p3
        this.pointsCtr[4].setPoint(x0, y0 - r, 1) //p4
        this.pointsCtr[5].setPoint(x0 + r * Math.sqrt(3), y0 - r, 0.5) //p5
        this.pointsCtr[6].setPoint(x0 + (r * Math.sqrt(3)) / 2, y0 + r / 2, 1) //p6 == p0
        this.setVertices()

        if (this.drawCirclePoints) this.calculateCirclePoints()

        this.setVertexBuffersAndDraw()
    },

    /// \param [in] n,k,t,knot_vector
    /// \return i
    findSpan(n, k, t, knot_vector) {
        if (t == knot_vector[n + 1]) return n /* Special case */
        /* Do binary search */
        let low, high, mid
        low = k
        high = n + 1
        mid = Math.floor((low + high) / 2)
        while (t < knot_vector[mid] || t >= knot_vector[mid + 1]) {
            if (t < knot_vector[mid]) high = mid
            else low = mid
            mid = Math.floor((low + high) / 2)
        }
        return Math.floor(mid)
    },

    // param [in] i,t,k,knot_vector
    // param [out] N (массив базисных, нумерация с нуля!)
    basisFunc(i, t, k, knot_vector, N) {
        const A = new Float32Array(k + 1)
        A[0] = 1.0
        const right = new Float32Array(k + 1)
        const left = new Float32Array(k + 1)
        let saved, temp
        for (let j = 1; j <= k; j++) {
            left[j] = t - knot_vector[i + 1 - j]
            right[j] = knot_vector[i + j] - t
            saved = 0.0
            for (let r = 0; r < j; r++) {
                temp = A[r] / (right[r + 1] + left[j - r])
                A[r] = saved + right[r + 1] * temp
                saved = left[j - r] * temp
            }
            A[j] = saved
        }
        //N (массив базисных, нумерация с i-k!)
        for (let j = i - k; j <= i; j++) {
            N[j] = A[j - (i - k)]
        }
    },

    calculateSpline: function () {
        // ДОБАВИТЬ ПЕРЕМЕННЫЕ И ИНИЦИАЛИЗАЦИЮ ШАГА ПО ПАРАМЕТРИЧЕСКОЙ КООРДИНАТЕ t ДЛЯ ПОСТРОЕНИЯ СПЛАЙНА
        let i, j
        let pt
        let t, x, y, dt, H, k, n
        n = this.pointsCtr.length - 1
        k = 2

        const knot_vector = new Float32Array([
            0.0,
            0.0,
            0.0,
            1 / 3,
            1 / 3,
            2 / 3,
            2 / 3,
            1.0,
            1.0,
            1.0,
        ])
        const M = this.countSplinePoints.value
        this.pointsSpline = new Array(M)
        const R = new Float32Array(M)
        // РАСЧЕТ КООРДИНАТ ТОЧКИ СПЛАЙНА
        dt = 1 / (M - 1)

        for (j = 0; j < M; j++) {
            t = j * dt
            i = this.findSpan(n, k, t, knot_vector)
            const N = new Float32Array(this.pointsCtr.length)
            this.basisFunc(i, t, k, knot_vector, N)

            H = 0.0
            for (let r = 0; r < this.pointsCtr.length; r++) {
                H += this.pointsCtr[r].h * N[r]
            }
            for (let r = 0; r < this.pointsCtr.length; r++) {
                R[r] = (this.pointsCtr[r].h * N[r]) / H
            }
            x = 0.0
            y = 0.0
            for (let r = 0; r < this.pointsCtr.length; r++) {
                x += this.pointsCtr[r].x * R[r]
                y += this.pointsCtr[r].y * R[r]
            }
            pt = new Point(x, y)
            this.pointsSpline[j] = pt
        }

        this.verticesSpline = new Float32Array(M * 2)
        for (j = 0; j < this.pointsSpline.length; j++) {
            this.verticesSpline[j * 2] = this.pointsSpline[j].x
            this.verticesSpline[j * 2 + 1] = this.pointsSpline[j].y
        }
    },

    calculateCirclePoints: function () {
        let pt
        let i
        let phi, x, y, dPhi

        const x0 = parseInt(this.x0.value)
        const y0 = parseInt(this.y0.value)
        const r = parseInt(this.radius.value)

        const N = this.countCirclePoints.value
        this.pointsCircle = new Array(N)

        dPhi = (2.0 * Math.PI) / (N - 1)
        phi = 0

        for (i = 0; i < N; i++) {
            x = x0 + r * Math.cos(phi)
            y = y0 + r * Math.sin(phi)
            pt = new Point(x, y)

            phi += dPhi

            this.pointsCircle[i] = pt
        }

        this.verticesCircle = new Float32Array(N * 2)

        for (i = 0; i < N; i++) {
            this.verticesCircle[i * 2] = this.pointsCircle[i].x
            this.verticesCircle[i * 2 + 1] = this.pointsCircle[i].y
        }
    },
}

function mousedown(ev, canvas) {
    const x = ev.clientX // x coordinate of a mouse pointer
    const y = ev.clientY // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect()

    Data.mousedownHandler(
        EventUtil.getButton(ev),
        x - rect.left,
        canvas.height - (y - rect.top)
    )
}

function mouseup(ev, canvas) {
    const x = ev.clientX // x coordinate of a mouse pointer
    const y = ev.clientY // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect()

    Data.mouseupHandler(
        EventUtil.getButton(ev),
        x - rect.left,
        canvas.height - (y - rect.top)
    )
}

function mousemove(ev, canvas) {
    const x = ev.clientX // x coordinate of a mouse pointer
    const y = ev.clientY // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect()
    //if (ev.buttons == 1)
    //    alert('with left key');
    Data.mousemoveHandler(x - rect.left, canvas.height - (y - rect.top))
}
