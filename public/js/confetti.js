class ConfettiManager
{
    constructor()
    {
        this.canvas = null;
        this.ctx = null;
        this.confetti = [];
        this.animationId = null;
    }

    celebrate(duration = 3000, particleCount = 150)
    {
        this.createCanvas();
        this.generateConfetti(particleCount);
        this.animate();

        setTimeout(() => this.stop(), duration);
    }

    createCanvas()
    {
        if (this.canvas)
            this.canvas.remove();

        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10000;';
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        document.body.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
    }

    generateConfetti(count)
    {
        this.confetti = [];
        const colours = [
            '#667eea', '#764ba2', '#f093fb', '#f5576c',
            '#4bc292', '#56a887', '#ff9a00', '#fda200',
            '#5a8ddb', '#f3b958', '#fe5f55', '#8867a5'
        ];

        for (let i = 0; i < count; i++)
        {
            this.confetti.push({
                x: Math.random() * this.canvas.width,
                y: -20 - Math.random() * 100,
                size: Math.random() * 8 + 4,
                colour: colours[Math.floor(Math.random() * colours.length)],
                velocityX: Math.random() * 6 - 3,
                velocityY: Math.random() * 3 + 2,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 10 - 5,
                opacity: 1,
                shape: Math.random() > 0.5 ? 'square' : 'circle'
            });
        }
    }

    animate()
    {
        if (!this.ctx)
            return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.confetti.forEach((piece, index) => {
            piece.x += piece.velocityX;
            piece.y += piece.velocityY;
            piece.rotation += piece.rotationSpeed;
            piece.velocityY += 0.1;

            if (piece.y > this.canvas.height * 0.75)
                piece.opacity -= 0.02;

            if (piece.y > this.canvas.height + 20 || piece.opacity <= 0)
            {
                this.confetti.splice(index, 1);
                return;
            }
            
            this.ctx.save();
            this.ctx.translate(piece.x, piece.y);
            this.ctx.rotate((piece.rotation * Math.PI) / 180);
            this.ctx.globalAlpha = piece.opacity;
            this.ctx.fillStyle = piece.colour;

            if (piece.shape === 'circle')
            {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
            else this.ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);

            this.ctx.restore();
        });

        if (this.confetti.length > 0)
            this.animationId = requestAnimationFrame(() => this.animate());
        else
            this.stop();
    }

    stop()
    {
        if (this.animationId)
        {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.canvas)
        {
            this.canvas.remove();
            this.canvas = null;
            this.ctx = null;
        }

        this.confetti = [];
    }
}

const confetti = new ConfettiManager();

export { ConfettiManager, confetti };

window.confetti = confetti;